import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPracticeSystemPrompt, buildPracticeUserMessage } from "@/lib/prompts/practice";
import { getExamById } from "@/lib/exams";
import { buildPracticeRAGContext } from "@/lib/rag/context-builder";
import { getWeakPoints, getRecommendedDifficulty, updateStreak } from "@/lib/adaptive-engine";
import { practicePostSchema, practicePutSchema, parseBody } from "@/lib/validations";
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

  const limited = checkRateLimit(user.id, "practice:post", RATE_LIMITS.ai);
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
  const parsed = parseBody(practicePostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, topic, difficulty, questionType } = parsed.data;

  const exam = getExamById(examId);
  if (!exam) {
    return Response.json({ error: "不明な試験カテゴリです" }, { status: 400 });
  }

  let systemPrompt = buildPracticeSystemPrompt(exam.name);

  // RAGコンテキストを取得
  if (process.env.VOYAGE_API_KEY) {
    try {
      const ragContext = await buildPracticeRAGContext({
        examId,
        subject,
        topic,
      });
      if (ragContext) {
        systemPrompt += ragContext;
      }
    } catch (err) {
      console.error("RAGコンテキスト取得エラー:", err);
    }
  }

  // 適応学習: 弱点と推奨難易度を取得
  const [weakPoints, recommendedDifficulty] = await Promise.all([
    getWeakPoints(supabase, user.id, examId, 5),
    getRecommendedDifficulty(supabase, user.id, examId, subject),
  ]);

  const effectiveDifficulty = difficulty || recommendedDifficulty;
  const weakTopics = weakPoints.map((wp) => `${wp.subject}>${wp.topic}(正答率${wp.accuracyPct}%)`);

  const userMessage = buildPracticeUserMessage({
    subject,
    topic,
    difficulty: effectiveDifficulty,
    questionType: questionType || "multiple_choice",
    weakPoints: weakTopics,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // JSONをパース
    let parsed;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        parsed = JSON.parse(text);
      }
    } catch {
      return Response.json({ error: "問題の生成に失敗しました。もう一度お試しください。" }, { status: 500 });
    }

    // 無料プランの場合、使用回数を増やす
    if (profile.plan === "free") {
      await supabase
        .from("profiles")
        .update({ free_reviews_used: profile.free_reviews_used + 1 })
        .eq("id", user.id);
    }

    return Response.json({ question: parsed, examId, subject });
  } catch {
    return Response.json({ error: "問題生成中にエラーが発生しました" }, { status: 500 });
  }
}

// 回答を保存
export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(user.id, "practice:put", RATE_LIMITS.write);
  if (limited) return limited;

  const body = await request.json();
  const parsed = parseBody(practicePutSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, topic, question, questionType, userAnswer, correctAnswer, isCorrect, explanation, difficulty } = parsed.data;

  await supabase.from("practice_results").insert({
    user_id: user.id,
    exam_id: examId,
    subject,
    topic,
    question_type: questionType,
    question,
    user_answer: userAnswer,
    correct_answer: correctAnswer,
    is_correct: isCorrect,
    explanation,
    difficulty,
  });

  // ストリーク更新
  await updateStreak(supabase, user.id, 1, isCorrect ? 1 : 0);

  return Response.json({ ok: true });
}
