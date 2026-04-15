import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSocraticSystemPrompt } from "@/lib/prompts/socratic";
import { getExamById } from "@/lib/exams";
import { getWeakPoints } from "@/lib/adaptive-engine";
import { teachPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  simulateCascadeCollapse,
  runCounterfactualScan,
  calcEffectiveConfidence,
  calcRetention,
  type CoreKnowledgeRow,
} from "@/lib/core-engine";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "socratic:post", RATE_LIMITS.ai);
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

  const weakPoints = await getWeakPoints(supabase, user.id, examId, 10);

  // Core知識を読み込み（先制介入用）
  const { data: coreEntries } = await supabase
    .from("core_knowledge")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false })
    .limit(200);

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

  // Core先制介入: Mentorに聞く前に「自分の知識で答えられるはず」チェック
  let coreIntervention: { type: string; message: string } | null = null;
  if (allCore.length >= 5) {
    const topicLower = (topic || subject).toLowerCase();

    // この話題に関する高EC知識があるなら「自分で考えてみない？」
    const relevantKnowledge = allCore.filter(e =>
      (e.topic?.toLowerCase().includes(topicLower) || e.subject.toLowerCase().includes(topicLower)) &&
      calcEffectiveConfidence(e, allCore) > 0.6
    );
    if (relevantKnowledge.length >= 2 && history && history.length === 0) {
      coreIntervention = {
        type: "self_answer_first",
        message: `この話題、Coreにはすでに${relevantKnowledge.length}個の知識がある（実効確信度${Math.round(relevantKnowledge.reduce((s, e) => s + calcEffectiveConfidence(e, allCore), 0) / relevantKnowledge.length * 100)}%）。先に自分で答えを考えてみない？`,
      };
    }

    // 連鎖崩壊チェック
    if (!coreIntervention) {
      const cascades = simulateCascadeCollapse(allCore);
      const relevantCascade = cascades.find(c =>
        c.root.topic?.toLowerCase().includes(topicLower) ||
        c.casualties.some(cas => cas.topic?.toLowerCase().includes(topicLower))
      );
      if (relevantCascade && relevantCascade.severity > 0.3) {
        coreIntervention = {
          type: "cascade_warning",
          message: `待って、この話題に関連する「${relevantCascade.root.topic || relevantCascade.root.subject}」の記憶が薄れてる。${relevantCascade.casualties.length}個の知識が巻き添えになるから、先にそっちを確認しない？`,
        };
      }
    }
  }

  const systemPrompt = buildSocraticSystemPrompt({ examName: exam.name, subject, topic, weakPoints });

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  if (history && Array.isArray(history) && history.length > 0) {
    for (const msg of history.slice(-20)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: message });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  let fullResult = "";
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Core先制介入をストリーム冒頭で送信
        if (coreIntervention) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ coreIntervention })}\n\n`));
        }

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullResult += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }

        await supabase.from("chat_messages").insert([
          { user_id: user.id, exam_id: examId, subject, role: "user", content: message },
          { user_id: user.id, exam_id: examId, subject, role: "assistant", content: fullResult },
        ]);

        if (profile.plan === "free") {
          await supabase.from("profiles")
            .update({ free_reviews_used: profile.free_reviews_used + 1 })
            .eq("id", user.id);
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        console.error("socratic streaming error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "エラーが発生しました" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
