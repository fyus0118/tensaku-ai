import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getExamById } from "@/lib/exams";
import { sm2 } from "@/lib/adaptive-engine";
import { flashcardsPostSchema, flashcardsPutSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  feedbackFromPractice,
  calcEffectiveConfidence,
  calcRetention,
  buildReviewSchedule,
  type CoreKnowledgeRow,
} from "@/lib/core-engine";

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

  // Core Brain Model: 知識の状態からカード内容を最適化
  const { data: coreEntries } = await supabase
    .from("core_knowledge")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("subject", subject)
    .order("created_at", { ascending: false })
    .limit(100);

  const allCore: CoreKnowledgeRow[] = (coreEntries || []).map((e: Record<string, unknown>) => ({
    ...e,
    operation_evidence: e.operation_evidence || { recognized: false, reproduced: false, explained: false, applied: false, integrated: false },
    connection_strengths: e.connection_strengths || {},
    retrieval_contexts: e.retrieval_contexts || [],
    stability: e.stability || 3.0,
    retrieval_count: e.retrieval_count || 0,
    retrieval_success_count: e.retrieval_success_count || 0,
    retrieval_fail_count: e.retrieval_fail_count || 0,
    interference_count: e.interference_count || 0,
    rag_verification_status: e.rag_verification_status || "unverified",
  })) as CoreKnowledgeRow[];

  // 弱い知識・干渉リスクの高い知識を特定
  const weakKnowledge = allCore
    .filter(e => {
      const ec = calcEffectiveConfidence(e, allCore);
      return ec < 0.6 || e.interference_count >= 2 || e.initial_mistake;
    })
    .slice(0, 5)
    .map(e => {
      const ec = calcEffectiveConfidence(e, allCore);
      let note = `${e.topic || "全般"}: 実効${Math.round(ec * 100)}%`;
      if (e.initial_mistake) note += `, 過去の間違い「${e.initial_mistake.slice(0, 50)}」`;
      if (e.interference_count >= 2) note += `, 干渉${e.interference_count}回`;
      return `- ${note}`;
    })
    .join("\n");

  let coreContext = "";
  if (weakKnowledge) {
    coreContext = `\n\n## この受験生の弱点（Core Brain Model分析）
以下の知識が不安定です。これらを重点的にカード化してください。
特に過去の間違いがある場合、その間違いやすいポイントをfrontに含めてください。
${weakKnowledge}`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `あなたは${exam.name}のFlashcards生成AIです。
以下のJSON配列形式でFlashcardsを生成してください。JSON以外は出力しないでください。

[
  { "front": "問題・キーワード（簡潔に）", "back": "解答・解説（覚えるべきポイント）", "topic": "分野名" },
  ...
]

ルール:
- 試験で実際に問われる重要な知識に絞る
- frontは簡潔（1〜2文）、backは必要十分（条文番号・判例名含む）
- 語呂合わせや覚え方があれば積極的に含める
- 紛らわしい知識は比較で整理する${coreContext}`,
    messages: [{
      role: "user",
      content: `${subject}${topic ? `（${topic}）` : ""}のFlashcardsを${count}枚生成してください。`,
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

  // Core Brain Model: flashcard結果をCoreにフィードバック
  // quality 3+ = 想起成功、quality 0-2 = 想起失敗
  feedbackFromPractice(
    supabase, user.id, card.exam_id, card.subject, card.topic,
    quality >= 3, quality, "flashcard"
  ).catch(err => console.error("core feedback error:", err));

  return Response.json({ ok: true, nextReview: result.nextReviewAt });
}
