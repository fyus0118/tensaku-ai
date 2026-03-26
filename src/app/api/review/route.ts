import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { ESSAY_SYSTEM_PROMPT, ESSAY_KNOWLEDGE } from "@/lib/prompts/essay";
import { REPORT_SYSTEM_PROMPT, REPORT_KNOWLEDGE } from "@/lib/prompts/report";
import { reviewPostSchema, parseBody } from "@/lib/validations";
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

  const limited = checkRateLimit(user.id, "review:post", RATE_LIMITS.ai);
  if (limited) return limited;

  // プロフィール取得
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
      { error: "無料プランの添削回数（3回）を使い切りました。プロプランにアップグレードしてください。" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = parseBody(reviewPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const {
    reviewType,
    content,
    documentType,
    targetUniversity,
    targetDepartment,
    examType,
    theme,
    wordLimit,
    grade,
    citationStyle,
  } = parsed.data;

  // システムプロンプトとナレッジの選択
  const isEssay = reviewType === "essay";
  const systemPrompt = isEssay ? ESSAY_SYSTEM_PROMPT : REPORT_SYSTEM_PROMPT;
  const knowledge = isEssay ? ESSAY_KNOWLEDGE : REPORT_KNOWLEDGE;

  // ユーザーメッセージの構築
  let userMessage = "";

  if (isEssay) {
    userMessage = `以下の情報に基づいて添削してください。

【文章の種類】${documentType || "小論文"}
${targetUniversity ? `【志望大学】${targetUniversity}` : ""}
${targetDepartment ? `【学部】${targetDepartment}` : ""}
${examType ? `【入試形態】${examType}` : ""}
${theme ? `【テーマ・設問】${theme}` : ""}
${wordLimit ? `【指定文字数】${wordLimit}字` : ""}

【添削対象の文章】
${content}`;
  } else {
    userMessage = `以下の情報に基づいて添削してください。

${grade ? `【学年】${grade}` : ""}
${documentType ? `【レポートの種類】${documentType}` : ""}
${targetDepartment ? `【学部・学科】${targetDepartment}` : ""}
${theme ? `【課題の内容・テーマ】${theme}` : ""}
${wordLimit ? `【指定文字数】${wordLimit}字` : ""}
${citationStyle ? `【引用スタイル】${citationStyle}` : ""}

【添削対象のレポート】
${content}`;
  }

  // ストリーミングレスポンス
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `${systemPrompt}\n\n## ナレッジベース\n\n${knowledge}`,
    messages: [{ role: "user", content: userMessage }],
  });

  // 全文を収集してDBに保存するためのバッファ
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
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // スコアを抽出（「総合スコア：XX点」のパターン）
        const scoreMatch = fullResult.match(/総合スコア[：:]\s*(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

        const wordLimitNum = wordLimit ? (typeof wordLimit === "string" ? parseInt(wordLimit, 10) : wordLimit) : null;

        // DBに保存
        await supabase.from("reviews").insert({
          user_id: user.id,
          review_type: reviewType,
          document_type: documentType,
          target_university: targetUniversity,
          target_department: targetDepartment,
          exam_type: examType,
          theme,
          word_limit: wordLimitNum,
          grade,
          citation_style: citationStyle,
          content,
          score,
          result: fullResult,
        });

        // 無料プランの場合、使用回数を増やす
        if (profile.plan === "free") {
          await supabase
            .from("profiles")
            .update({ free_reviews_used: profile.free_reviews_used + 1 })
            .eq("id", user.id);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, score })}\n\n`
          )
        );
        controller.close();
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "添削中にエラーが発生しました" })}\n\n`
          )
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
