import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildTeachSystemPrompt, buildTeachFirstMessage } from "@/lib/prompts/teach";
import { getExamById } from "@/lib/exams";
import { getWeakPoints } from "@/lib/adaptive-engine";
import { teachPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(user.id, "teach:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  if (profile.plan === "free" && profile.free_reviews_used >= profile.free_reviews_limit) {
    return Response.json(
      { error: "無料プランの利用回数を使い切りました。プロプランにアップグレードしてください。" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = parseBody(teachPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, topic, message, history } = parsed.data;

  const exam = getExamById(examId);
  if (!exam) {
    return Response.json({ error: "不明な試験カテゴリです" }, { status: 400 });
  }

  // ユーザーの弱点を取得してAI後輩の間違え戦略に使う
  const weakPoints = await getWeakPoints(supabase, user.id, examId, 10);

  const systemPrompt = buildTeachSystemPrompt({
    examName: exam.name,
    subject,
    topic,
    weakPoints,
  });

  // 会話履歴を構築
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  if (history && Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-20);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: message });
  } else {
    // 初回: AI後輩の最初の質問 + ユーザーの応答
    const firstMsg = buildTeachFirstMessage(subject, topic);
    messages.push({ role: "assistant", content: firstMsg });
    messages.push({ role: "user", content: message });
  }

  // ストリーミング
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
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResult += text;
            // 隠しタグはフロントに送らない
            const cleanText = text.replace(/<!--(CAUGHT|MISSED|ERROR|CORRECT):.*?-->/g, "");
            if (cleanText) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: cleanText })}\n\n`)
              );
            }
          }
        }

        // 隠しタグから診断データを抽出
        const caught = [...fullResult.matchAll(/<!--CAUGHT:(.*?)-->/g)].map(m => m[1]);
        const missed = [...fullResult.matchAll(/<!--MISSED:(.*?)-->/g)].map(m => m[1]);
        const errors = [...fullResult.matchAll(/<!--ERROR:(.*?)-->/g)].map(m => m[1]);
        const correct = [...fullResult.matchAll(/<!--CORRECT:(.*?)-->/g)].map(m => m[1]);
        const verified = [...fullResult.matchAll(/<!--VERIFIED:(.*?)-->/g)].map(m => m[1]);

        // 表示用テキスト（タグ除去）
        const cleanResult = fullResult.replace(/<!--(CAUGHT|MISSED|ERROR|CORRECT|VERIFIED):.*?-->/g, "").trim();

        // DBに保存
        await supabase.from("chat_messages").insert([
          { user_id: user.id, exam_id: examId, subject, role: "user", content: message },
          { user_id: user.id, exam_id: examId, subject, role: "assistant", content: cleanResult },
        ]);

        // Core蓄積: CORRECT + VERIFIEDのみ（検証済み知識）
        const coreEntries = [
          ...correct.map(c => ({ type: "correct" as const, content: c })),
          ...verified.map(v => ({ type: "verified" as const, content: v })),
        ];

        if (coreEntries.length > 0) {
          try {
            await supabase.from("core_knowledge").insert(
              coreEntries.map(entry => ({
                user_id: user.id,
                exam_id: examId,
                subject,
                topic: topic || null,
                content: entry.content,
                source: entry.type,
                understanding_depth: entry.type === "verified" ? 5 : 3,
              }))
            );
          } catch (err) {
            console.error("core_knowledge insert error:", err);
          }
        }

        // 診断データを記録
        if (caught.length > 0 || missed.length > 0 || errors.length > 0) {
          try {
            await supabase.from("teach_diagnostics").insert({
              user_id: user.id,
              exam_id: examId,
              subject,
              topic: topic || null,
              caught,
              missed,
              errors,
              correct,
              verified,
            });
          } catch (err) {
            console.error("teach_diagnostics insert error:", err);
          }
        }

        // 無料プランの場合、使用回数を増やす
        if (profile.plan === "free") {
          await supabase
            .from("profiles")
            .update({ free_reviews_used: profile.free_reviews_used + 1 })
            .eq("id", user.id);
        }

        // 診断カウントをフロントに送信
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            diagnostics: {
              caught: caught.length,
              missed: missed.length,
              errors: errors.length,
              correct: correct.length,
            },
          })}\n\n`)
        );

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (err) {
        console.error("teach streaming error:", err);
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
