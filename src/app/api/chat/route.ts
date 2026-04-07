import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildTutorSystemPrompt } from "@/lib/prompts/tutor";
import { getExamById } from "@/lib/exams";
import { buildTutorRAGBundle, type RAGReference } from "@/lib/rag/context-builder";
import { chatPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// 会話履歴を取得
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "chat:get", RATE_LIMITS.read);
  if (limited) return limited;

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  const subject = url.searchParams.get("subject");

  if (!examId) return Response.json({ messages: [] });

  let query = supabase
    .from("chat_messages")
    .select("role, content, metadata, created_at")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (subject) {
    query = query.eq("subject", subject);
  }

  const { data } = await query;
  return Response.json({ messages: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(user.id, "chat:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  // 無料プランの回数チェック
  if (profile.plan === "free" && profile.free_reviews_used >= profile.free_reviews_limit) {
    return Response.json(
      { error: "無料プランの利用回数を使い切りました。プロプランにアップグレードしてください。" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = parseBody(chatPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, message, history } = parsed.data;

  const exam = getExamById(examId);
  if (!exam) {
    return Response.json({ error: "不明な試験カテゴリです" }, { status: 400 });
  }

  let systemPrompt = buildTutorSystemPrompt(exam.name, subject);
  let references: RAGReference[] = [];

  // RAGコンテキストを取得して注入（Bedrock Titan Embed）
  try {
    const rag = await buildTutorRAGBundle({
      query: message,
      examId,
      subject,
      userId: user.id,
    });
    references = rag.references;
    if (rag.context) {
      systemPrompt += rag.context;
    }
  } catch (err) {
    console.error("RAGコンテキスト取得エラー:", err);
  }

  // 直近の会話履歴をメッセージに変換（最大20件）
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  if (history && Array.isArray(history)) {
    const recent = history.slice(-20);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: message });

  // ストリーミング
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ references })}\n\n`)
        );

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResult += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // DBに保存
        await supabase.from("chat_messages").insert([
          { user_id: user.id, exam_id: examId, subject, role: "user", content: message },
          {
            user_id: user.id,
            exam_id: examId,
            subject,
            role: "assistant",
            content: fullResult,
            metadata: { references },
          },
        ]);

        // 無料プランの場合、使用回数を増やす
        if (profile.plan === "free") {
          await supabase
            .from("profiles")
            .update({ free_reviews_used: profile.free_reviews_used + 1 })
            .eq("id", user.id);
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, references })}\n\n`)
        );
        controller.close();
      } catch (err) {
        console.error("chat streaming error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "エラーが発生しました" })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
