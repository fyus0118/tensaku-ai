import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPracticeSystemPrompt, buildPracticeUserMessage } from "@/lib/prompts/practice";
import { getExamById } from "@/lib/exams";
import { buildPracticeRAGContext } from "@/lib/rag/context-builder";
import { getWeakPoints, getRecommendedDifficulty, updateStreak } from "@/lib/adaptive-engine";
import { practicePostSchema, practicePutSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  feedbackFromPractice,
  calcEffectiveConfidence,
  calcRetention,
  predictTraps,
  buildReviewSchedule,
  simulateCascadeCollapse,
  runCounterfactualScan,
  type CoreKnowledgeRow,
} from "@/lib/core-engine";

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

  // 課金ゲート一時無効化（無料公開中）

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

  let systemPrompt = buildPracticeSystemPrompt(exam.name, questionType || "multiple_choice");

  // RAGコンテキストを取得（Bedrock Titan Embed）
  try {
    const ragContext = await buildPracticeRAGContext({
      examId,
      subject,
      topic,
      userId: user.id,
    });
    if (ragContext) {
      systemPrompt += ragContext;
    }
  } catch (err) {
    console.error("RAGコンテキスト取得エラー:", err);
  }

  // 適応学習: 弱点と推奨難易度を取得
  const [weakPoints, recommendedDifficulty] = await Promise.all([
    getWeakPoints(supabase, user.id, examId, 5),
    getRecommendedDifficulty(supabase, user.id, examId, subject),
  ]);

  // Core Brain Model: 知識の状態から出題を最適化
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
    stability: e.stability || 3.0,
    retrieval_count: e.retrieval_count || 0,
    retrieval_success_count: e.retrieval_success_count || 0,
    retrieval_fail_count: e.retrieval_fail_count || 0,
    interference_count: e.interference_count || 0,
    rag_verification_status: e.rag_verification_status || "unverified",
  })) as CoreKnowledgeRow[];

  // Coreの落とし穴予測から出題ヒントを生成
  const traps = predictTraps(allCore).slice(0, 5);
  const trapHints = traps.length > 0
    ? traps.map(t => `- [${t.trapType}] ${t.subject}>${t.topic}: ${t.description.slice(0, 100)}`).join("\n")
    : "";

  // Coreの復習スケジュールから優先出題対象を特定
  const reviewSchedule = buildReviewSchedule(allCore, allCore).slice(0, 5);
  const reviewHints = reviewSchedule.length > 0
    ? reviewSchedule.map(r => `- ${r.subject}>${r.topic || "全般"}: 記憶${Math.round(r.currentRetention * 100)}%, 実効${Math.round(r.effectiveConfidence * 100)}%`).join("\n")
    : "";

  // Coreの過信知識（confidence高いがeffectiveConfidence低い）
  const overconfident = allCore
    .filter(e => e.confidence > 0.7 && calcEffectiveConfidence(e, allCore) < 0.5)
    .slice(0, 3)
    .map(e => `- ${e.subject}>${e.topic}: 自信${Math.round(e.confidence * 100)}%→実効${Math.round(calcEffectiveConfidence(e, allCore) * 100)}%`)
    .join("\n");

  // Core情報をシステムプロンプトに注入
  if (trapHints || reviewHints || overconfident) {
    systemPrompt += `\n\n## Core Brain Model分析（この受験生の知識状態）\n`;
    if (trapHints) {
      systemPrompt += `### 落とし穴（この受験生が引っかかりやすいポイント）\n${trapHints}\nこれらのポイントを突く問題を優先的に出題してください。\n\n`;
    }
    if (overconfident) {
      systemPrompt += `### 過信している知識（わかったつもりの箇所）\n${overconfident}\n実は理解が浅い箇所なので、応用問題で揺さぶってください。\n\n`;
    }
    if (reviewHints) {
      systemPrompt += `### 忘却しかけている知識\n${reviewHints}\nこれらのトピックに関連する出題も検討してください。\n`;
    }
  }

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

    // JSONをパース（ネストした波括弧を正しく扱う）
    let parsed;
    try {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlock) {
        parsed = JSON.parse(codeBlock[1]);
      } else {
        parsed = JSON.parse(text);
      }
    } catch {
      // コードブロック/全体パース失敗時: 波括弧の対応を追って最外JSONを抽出
      try {
        const start = text.indexOf("{");
        if (start === -1) throw new Error("no JSON");
        let depth = 0;
        let end = -1;
        for (let j = start; j < text.length; j++) {
          if (text[j] === "{") depth++;
          else if (text[j] === "}") depth--;
          if (depth === 0) { end = j; break; }
        }
        if (end === -1) throw new Error("unbalanced braces");
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        console.error("practice JSON parse failed. Raw output:", text.slice(0, 500));
        return Response.json({ error: "問題の生成に失敗しました。もう一度お試しください。" }, { status: 500 });
      }
    }

    // 無料プランの場合、使用回数を増やす
    if (profile.plan === "free") {
      await supabase
        .from("profiles")
        .update({ free_reviews_used: profile.free_reviews_used + 1 })
        .eq("id", user.id);
    }

    // Core先制介入: この問題に関連する崩壊リスク・脆弱性を検出
    let coreIntervention: {
      type: "cascade_warning" | "counterfactual_alert" | "foundation_risk";
      message: string;
    } | null = null;

    if (allCore.length >= 5) {
      const topicLower = (topic || subject).toLowerCase();

      // 連鎖崩壊: このトピックが崩壊起点に含まれていないか
      const cascades = simulateCascadeCollapse(allCore);
      const relevantCascade = cascades.find(c =>
        c.root.topic?.toLowerCase().includes(topicLower) ||
        c.root.subject.toLowerCase().includes(topicLower) ||
        c.casualties.some(cas => cas.topic?.toLowerCase().includes(topicLower))
      );
      if (relevantCascade && relevantCascade.severity > 0.3) {
        coreIntervention = {
          type: "cascade_warning",
          message: `待って。この問題に関連する知識「${relevantCascade.root.topic || relevantCascade.root.subject}」の記憶が薄れてきてる。これを忘れると${relevantCascade.casualties.length}個の知識が巻き添えになる。先にそっちを確認しない？`,
        };
      }

      // 反実仮想: この問題に関連する脆弱性
      if (!coreIntervention) {
        const vulns = runCounterfactualScan(allCore);
        const relevantVuln = vulns.find(v =>
          v.target.topic?.toLowerCase().includes(topicLower) ||
          v.impacted.some(i => i.topic?.toLowerCase().includes(topicLower))
        );
        if (relevantVuln && relevantVuln.vulnerabilityScore > 0.5) {
          coreIntervention = {
            type: "counterfactual_alert",
            message: `この問題に関連する「${relevantVuln.target.topic || relevantVuln.target.subject}」、確信度${Math.round(relevantVuln.target.confidence * 100)}%だけど、もし間違ってたら${relevantVuln.impacted.length}個の知識に影響する。慎重に。`,
          };
        }
      }
    }

    return Response.json({ question: parsed, examId, subject, coreIntervention });
  } catch (err) {
    console.error("practice generation error:", err);
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

  // Core Brain Model: 練習問題の結果をCoreにフィードバック
  if (topic) {
    feedbackFromPractice(
      supabase, user.id, examId, subject, topic,
      isCorrect, difficulty || 3, "practice"
    ).catch(err => console.error("core feedback error:", err));
  }

  return Response.json({ ok: true });
}
