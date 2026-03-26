import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getExamById } from "@/lib/exams";
import { sm2 } from "@/lib/adaptive-engine";
import { flashcardsPostSchema, flashcardsPutSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// フラッシュカードをAI生成
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "flashcards:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const body = await request.json();
  const parsed = parseBody(flashcardsPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, topic, count = 5 } = parsed.data;

  const exam = getExamById(examId);
  if (!exam) return Response.json({ error: "不明な試験" }, { status: 400 });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `あなたは${exam.name}の暗記カード生成AIです。
以下のJSON配列形式で暗記カードを生成してください。JSON以外は出力しないでください。

[
  { "front": "問題・キーワード（簡潔に）", "back": "解答・解説（覚えるべきポイント）", "topic": "分野名" },
  ...
]

ルール:
- 試験で実際に問われる重要な知識に絞る
- frontは簡潔（1〜2文）、backは必要十分（条文番号・判例名含む）
- 語呂合わせや覚え方があれば積極的に含める
- 紛らわしい知識は比較で整理する`,
    messages: [{
      role: "user",
      content: `${subject}${topic ? `（${topic}）` : ""}の暗記カードを${count}枚生成してください。`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let cards;
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
    cards = JSON.parse(match ? match[1] : text);
  } catch {
    return Response.json({ error: "カード生成に失敗しました" }, { status: 500 });
  }

  // DBに保存
  const rows = cards.map((card: { front: string; back: string; topic?: string }) => ({
    user_id: user.id,
    exam_id: examId,
    subject,
    topic: card.topic || topic || "",
    front: card.front,
    back: card.back,
  }));

  const { data: inserted } = await supabase.from("flashcards").insert(rows).select();

  return Response.json({ cards: inserted });
}

// 復習対象のカードを取得
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "flashcards:get", RATE_LIMITS.read);
  if (limited) return limited;

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  const limitParam = parseInt(url.searchParams.get("limit") || "20");
  const limit = Math.min(Math.max(1, limitParam), 100); // 1〜100に制限

  let query = supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", user.id)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(limit);

  if (examId) {
    query = query.eq("exam_id", examId);
  }

  const { data } = await query;
  return Response.json({ cards: data || [] });
}

// カードの復習結果を記録（SM-2更新）
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "flashcards:put", RATE_LIMITS.write);
  if (limited) return limited;

  const body = await request.json();
  const parsed = parseBody(flashcardsPutSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { cardId, quality } = parsed.data;

  // 現在のカードデータ取得（user_idで所有権チェック）
  const { data: card } = await supabase
    .from("flashcards")
    .select("*")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();

  if (!card) return Response.json({ error: "カードが見つかりません" }, { status: 404 });

  // SM-2計算
  const result = sm2(
    quality,
    card.ease_factor,
    card.interval_days,
    card.repetitions
  );

  await supabase
    .from("flashcards")
    .update({
      ease_factor: result.easeFactor,
      interval_days: result.interval,
      repetitions: result.repetitions,
      next_review_at: result.nextReviewAt.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", cardId);

  return Response.json({ ok: true, nextReview: result.nextReviewAt });
}
