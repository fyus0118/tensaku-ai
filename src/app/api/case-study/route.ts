import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildCaseStudySystemPrompt } from "@/lib/prompts/case-study";
import { getExamById } from "@/lib/exams";
import { getRecommendedDifficulty } from "@/lib/adaptive-engine";
import { teachPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { type CoreKnowledgeRow } from "@/lib/core-engine";
import { parseHiddenTags, stripHiddenTags, upsertCoreKnowledge, degradeCoreKnowledge, HIDDEN_TAG_INSTRUCTION_CASE_STUDY } from "@/lib/core-knowledge-writer";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "case:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return Response.json({ error: "プロフィールが見つかりません" }, { status: 404 });

  // 課金ゲート一時無効化（無料公開中）

  const body = await request.json();
  const parsed = parseBody(teachPostSchema, body);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });

  const { examId, subject, topic, message, history } = parsed.data;
  const exam = getExamById(examId);
  if (!exam) return Response.json({ error: "不明な試験カテゴリです" }, { status: 400 });

  const difficulty = await getRecommendedDifficulty(supabase, user.id, examId, subject);

  const { data: coreEntries } = await supabase
    .from("core_knowledge").select("*")
    .eq("user_id", user.id).eq("exam_id", examId)
    .order("created_at", { ascending: false }).limit(200);
  const allCore: CoreKnowledgeRow[] = (coreEntries || []).map((e: Record<string, unknown>) => ({
    ...e,
    operation_evidence: e.operation_evidence || { recognized: false, reproduced: false, explained: false, applied: false, integrated: false },
    connection_strengths: e.connection_strengths || {},
    retrieval_contexts: e.retrieval_contexts || [],
    stability: (e.stability as number) || 3.0,
    retrieval_count: (e.retrieval_count as number) || 0,
    retrieval_success_count: (e.retrieval_success_count as number) || 0,
    retrieval_fail_count: (e.retrieval_fail_count as number) || 0,
    interference_count: (e.interference_count as number) || 0,
    rag_verification_status: (e.rag_verification_status as string) || "unverified",
  })) as CoreKnowledgeRow[];

  const systemPrompt = buildCaseStudySystemPrompt({ examName: exam.name, subject, topic, difficulty }) + HIDDEN_TAG_INSTRUCTION_CASE_STUDY;

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  if (history && Array.isArray(history) && history.length > 0) {
    for (const msg of history.slice(-20)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: message });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  let fullResult = "";
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            fullResult += text;
            const clean = stripHiddenTags(text);
            if (clean) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: clean })}\n\n`));
          }
        }

        const diagnostics = parseHiddenTags(fullResult);
        const cleanResult = stripHiddenTags(fullResult).trim();

        await supabase.from("chat_messages").insert([
          { user_id: user.id, exam_id: examId, subject, role: "user", content: message },
          { user_id: user.id, exam_id: examId, subject, role: "assistant", content: cleanResult },
        ]);

        const coreEntries2 = [
          ...diagnostics.correct.map(e => ({ ...e, source: "case_correct" })),
          ...diagnostics.applied.map(e => ({ ...e, source: "case_applied" })),
        ];
        if (coreEntries2.length > 0 || diagnostics.errors.length > 0 || diagnostics.missed.length > 0) {
          (async () => {
            try {
              if (coreEntries2.length > 0) {
                await upsertCoreKnowledge({
                  supabase, userId: user.id, examId, subject, topic: topic || null,
                  entries: coreEntries2, allExisting: allCore,
                  sessionContext: `case-study:${subject}/${topic || "general"}`,
                });
              }
              if (diagnostics.errors.length > 0 || diagnostics.missed.length > 0) {
                await degradeCoreKnowledge({
                  supabase, userId: user.id, examId, subject, topic: topic || null,
                  errors: diagnostics.errors, missed: diagnostics.missed,
                });
              }
            } catch (err) { console.error("case-study core write error:", err); }
          })();
        }

        if (profile.plan === "free") {
          await supabase.from("profiles")
            .update({ free_reviews_used: profile.free_reviews_used + 1 })
            .eq("id", user.id);
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, coreUpdated: coreEntries2.length })}\n\n`));
        controller.close();
      } catch (err) {
        console.error("case-study streaming error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "エラーが発生しました" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
