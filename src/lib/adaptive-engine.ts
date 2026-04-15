import type { SupabaseClient } from "@supabase/supabase-js";
import { getExamById } from "@/lib/exams";

// ── 合格ライン定義 ──────────────────────────────
export const PASS_REQUIREMENTS: Record<string, {
  passingScore: number;
  subjectWeights: Record<string, number>;
  minSubjectScore?: number;
  description: string;
}> = {
  "yobi-shihou": {
    passingScore: 63, subjectWeights: { "憲法": 1, "民法": 1.5, "刑法": 1, "商法": 0.8, "民事訴訟法": 0.8, "刑事訴訟法": 0.8, "行政法": 1, "一般教養": 0.5 },
    minSubjectScore: 40, description: "短答 270点中160点前後 + 論文合格点"
  },
  "shihou-shiken": {
    passingScore: 65, subjectWeights: { "憲法": 1, "民法": 1.5, "刑法": 1, "商法": 0.8, "民事訴訟法": 0.8, "刑事訴訟法": 0.8, "行政法": 1, "選択科目": 0.7 },
    minSubjectScore: 40, description: "短答+論文の総合点"
  },
  "shindan-shi": {
    passingScore: 60, subjectWeights: { "経済学・経済政策": 1, "財務・会計": 1.2, "企業経営理論": 1.2, "運営管理": 1, "経営法務": 0.8, "経営情報システム": 0.8, "中小企業経営・政策": 0.8, "2次試験（事例I〜IV）": 1.5 },
    minSubjectScore: 40, description: "1次 各科目40%以上かつ総点60%以上"
  },
  "kounin-kaikeishi": {
    passingScore: 65, subjectWeights: { "簿記": 1.2, "財務会計論": 1.2, "管理会計論": 1, "監査論": 1, "企業法": 1, "租税法": 1, "選択科目": 0.7 },
    minSubjectScore: 40, description: "短答70%前後 + 論文得点比率52%前後"
  },
  "takken": {
    passingScore: 70, subjectWeights: { "権利関係（民法等）": 1, "法令上の制限": 1, "宅建業法": 1.5, "税・その他": 0.8 },
    description: "50問中35問前後（年度により変動）"
  },
  "gyousei-shoshi": {
    passingScore: 60, subjectWeights: { "基礎法学": 0.5, "憲法": 1, "行政法": 1.5, "民法": 1.2, "商法・会社法": 0.8, "一般知識": 0.8 },
    minSubjectScore: 40, description: "法令等122点以上 + 一般知識24点以上 + 合計180点以上"
  },
  "sharoshi": {
    passingScore: 65, subjectWeights: { "労働基準法": 1, "労働安全衛生法": 0.8, "労災保険法": 1, "雇用保険法": 1, "健康保険法": 1, "国民年金法": 1, "厚生年金保険法": 1, "一般常識": 0.8 },
    minSubjectScore: 40, description: "選択式各3点以上 + 択一式各4点以上 + 総合点"
  },
  "fp2": {
    passingScore: 60, subjectWeights: { "ライフプランニング": 1, "リスク管理": 1, "金融資産運用": 1, "タックスプランニング": 1, "不動産": 1, "相続・事業承継": 1 },
    description: "学科60%以上 + 実技60%以上"
  },
  "koumuin": {
    passingScore: 60, subjectWeights: { "数的処理": 1.5, "文章理解": 1, "社会科学": 1, "人文科学": 0.8, "自然科学": 0.8, "専門科目": 1.5, "論文試験": 1 },
    description: "教養+専門の合計点（配点比率は試験種による）"
  },
  "ishi": {
    passingScore: 70, subjectWeights: { "内科学": 1.5, "外科学": 1, "産婦人科": 1, "小児科": 1, "公衆衛生": 1, "一般臨床": 1 },
    description: "必修80%以上 + 一般・臨床65%前後"
  },
  "kangoshi": {
    passingScore: 60, subjectWeights: { "基礎看護学": 1, "成人看護学": 1.2, "老年看護学": 1, "母性看護学": 1, "小児看護学": 1, "精神看護学": 1, "在宅看護論": 1, "健康支援と社会保障": 1 },
    description: "必修80%以上 + 一般問題65%前後"
  },
  "it-passport": {
    passingScore: 60, subjectWeights: { "ストラテジ系": 1, "マネジメント系": 1, "テクノロジ系": 1.2 },
    minSubjectScore: 30, description: "総合600点以上/1000点 + 各分野300点以上"
  },
  "kihon-jouhou": {
    passingScore: 60, subjectWeights: { "基礎理論": 1.2, "コンピュータシステム": 1, "技術要素": 1.2, "開発技術": 1, "マネジメント": 0.8, "ストラテジ": 0.8, "科目B（アルゴリズム）": 1.5 },
    description: "科目A・科目Bともに600点以上/1000点"
  },
  "boki2": {
    passingScore: 70, subjectWeights: { "商業簿記": 1.2, "工業簿記": 1 },
    description: "70点以上/100点で合格"
  },
  "boki3": {
    passingScore: 70, subjectWeights: { "簿記の基礎": 1, "取引と仕訳": 1.2, "決算": 1 },
    description: "70点以上/100点で合格"
  },
  "touroku-hanbai": {
    passingScore: 70, subjectWeights: { "医薬品に共通する特性と基本的な知識": 1, "人体の働きと医薬品": 1.2, "主な医薬品とその作用": 1.5, "薬事関連法規・制度": 1, "医薬品の適正使用・安全対策": 1 },
    minSubjectScore: 35, description: "総合70%以上 + 各科目35〜40%以上"
  },
};

/**
 * SM-2 間隔反復アルゴリズム
 * SuperMemo 2 をベースにした復習スケジューリング
 */
export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
}

/**
 * SM-2アルゴリズムで次の復習タイミングを計算
 * @param quality 回答の質 (0-5) 0=完全に忘れた, 5=完璧に覚えている
 * @param prevEaseFactor 前回のEF値 (初期値2.5)
 * @param prevInterval 前回の間隔（日数）
 * @param prevRepetitions 前回の反復回数
 */
export function sm2(
  quality: number,
  prevEaseFactor: number = 2.5,
  prevInterval: number = 0,
  prevRepetitions: number = 0
): SM2Result {
  // qualityを0-5に制限
  const q = Math.max(0, Math.min(5, quality));

  let ef = prevEaseFactor;
  let interval: number;
  let repetitions: number;

  if (q < 3) {
    // 不正解: リセット
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = prevRepetitions + 1;

    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(prevInterval * ef);
    }
  }

  // EF更新
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ef = Math.max(1.3, ef); // 最小EF = 1.3

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { easeFactor: ef, interval, repetitions, nextReviewAt };
}

/**
 * 練習問題の回答品質をSM-2のquality(0-5)に変換
 */
export function answerToQuality(isCorrect: boolean, timeSpentSeconds?: number): number {
  if (!isCorrect) return 1; // 不正解
  if (timeSpentSeconds && timeSpentSeconds < 10) return 5; // 即答で正解
  if (timeSpentSeconds && timeSpentSeconds < 30) return 4; // 素早く正解
  return 3; // 正解（普通）
}

/**
 * ユーザーの弱点分野を取得
 */
export interface WeakPoint {
  subject: string;
  topic: string;
  totalAttempts: number;
  correctCount: number;
  accuracyPct: number;
}

export async function getWeakPoints(
  supabase: SupabaseClient,
  userId: string,
  examId: string,
  limit: number = 10
): Promise<WeakPoint[]> {
  const { data } = await supabase
    .from("practice_results")
    .select("subject, topic, is_correct")
    .eq("user_id", userId)
    .eq("exam_id", examId);

  if (!data || data.length === 0) return [];

  // 科目×分野ごとに集計
  const stats: Record<string, { total: number; correct: number }> = {};

  for (const row of data) {
    const key = `${row.subject}::${row.topic || "全般"}`;
    if (!stats[key]) stats[key] = { total: 0, correct: 0 };
    stats[key].total++;
    if (row.is_correct) stats[key].correct++;
  }

  // 正答率の低い順にソート
  const weakPoints: WeakPoint[] = Object.entries(stats)
    .map(([key, val]) => {
      const [subject, topic] = key.split("::");
      return {
        subject,
        topic,
        totalAttempts: val.total,
        correctCount: val.correct,
        accuracyPct: Math.round((val.correct / val.total) * 100),
      };
    })
    .filter((wp) => wp.totalAttempts >= 2) // 最低2回以上解いた分野のみ
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, limit);

  return weakPoints;
}

/**
 * 次の出題の推奨難易度を計算
 * 直近の正答率に基づいて調整
 */
export async function getRecommendedDifficulty(
  supabase: SupabaseClient,
  userId: string,
  examId: string,
  subject: string
): Promise<number> {
  const { data } = await supabase
    .from("practice_results")
    .select("is_correct, difficulty")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("subject", subject)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data || data.length < 3) return 3; // デフォルト

  const recentAccuracy =
    data.filter((r) => r.is_correct).length / data.length;
  const avgDifficulty =
    data.reduce((sum, r) => sum + (r.difficulty || 3), 0) / data.length;

  if (recentAccuracy >= 0.8) {
    return Math.min(5, Math.ceil(avgDifficulty + 1)); // 正答率高い → 難易度上げる
  } else if (recentAccuracy <= 0.4) {
    return Math.max(1, Math.floor(avgDifficulty - 1)); // 正答率低い → 難易度下げる
  }

  return Math.round(avgDifficulty); // 維持
}

/**
 * 学習ストリークを更新
 */
// ── 合格予測 ─────────────────────────────────

export interface SubjectScore {
  subject: string;
  accuracy: number;
  weight: number;
  questionsAnswered: number;
  isAbovePassLine: boolean;
  gapToPassLine: number;
}

export interface PassPrediction {
  overallScore: number;
  passProbability: number;
  subjectScores: SubjectScore[];
  recommendation: string;
  questionsNeeded: number;
}

export async function getPrediction(
  supabase: SupabaseClient,
  userId: string,
  examId: string
): Promise<PassPrediction> {
  const req = PASS_REQUIREMENTS[examId];
  const exam = getExamById(examId);
  if (!req || !exam) {
    return { overallScore: 0, passProbability: 0, subjectScores: [], recommendation: "この試験の合格基準データがありません", questionsNeeded: 0 };
  }

  const { data: results } = await supabase
    .from("practice_results")
    .select("subject, is_correct")
    .eq("user_id", userId)
    .eq("exam_id", examId);

  if (!results || results.length === 0) {
    return { overallScore: 0, passProbability: 0, subjectScores: [], recommendation: "Practiceを解いて実力を測定しましょう", questionsNeeded: 50 };
  }

  // 科目別集計
  const stats: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    const s = r.subject || "その他";
    if (!stats[s]) stats[s] = { total: 0, correct: 0 };
    stats[s].total++;
    if (r.is_correct) stats[s].correct++;
  }

  const subjectScores: SubjectScore[] = exam.subjects.map((s) => {
    const st = stats[s.name] || { total: 0, correct: 0 };
    const accuracy = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
    const weight = req.subjectWeights[s.name] || 1;
    const passLine = req.minSubjectScore || req.passingScore;
    return {
      subject: s.name,
      accuracy,
      weight,
      questionsAnswered: st.total,
      isAbovePassLine: accuracy >= passLine,
      gapToPassLine: accuracy - passLine,
    };
  });

  // 加重平均スコア
  let weightedSum = 0, weightSum = 0;
  for (const ss of subjectScores) {
    if (ss.questionsAnswered > 0) {
      weightedSum += ss.accuracy * ss.weight;
      weightSum += ss.weight;
    }
  }
  const overallScore = weightSum > 0 ? Math.round(weightedSum / weightSum) : 0;

  // シグモイド関数で合格確率推定
  const passProbability = Math.round(100 / (1 + Math.exp(-0.15 * (overallScore - req.passingScore))));

  // 必要問題数の推定
  const gap = Math.max(0, req.passingScore - overallScore);
  const questionsNeeded = gap > 0 ? Math.ceil(gap * 3) : 0;

  // 推薦メッセージ
  let recommendation: string;
  const weakest = subjectScores.filter((s) => s.questionsAnswered >= 2).sort((a, b) => a.accuracy - b.accuracy)[0];
  if (passProbability >= 80) {
    recommendation = "合格圏内です。苦手科目の最終確認を行いましょう。";
  } else if (passProbability >= 50) {
    recommendation = weakest ? `${weakest.subject}（正答率${weakest.accuracy}%）を重点的に強化すれば合格圏内に入れます。` : "全体的にもう少し演習量を増やしましょう。";
  } else {
    recommendation = weakest ? `まず${weakest.subject}の基礎固めから始めましょう。毎日5問ずつ解くことを目標に。` : "Practiceを繰り返し解いて基礎力をつけましょう。";
  }

  return { overallScore, passProbability, subjectScores, recommendation, questionsNeeded };
}

// ── 学習パス ─────────────────────────────────

export interface StudyTask {
  type: "practice" | "flashcard" | "chat";
  subject: string;
  topic?: string;
  reason: string;
  difficulty: number;
  estimatedMinutes: number;
}

export interface StudyPath {
  dailyTasks: StudyTask[];
  weeklyGoals: { subject: string; targetAccuracy: number; currentAccuracy: number; questionsToSolve: number }[];
  daysUntilExam: number | null;
  focusAreas: string[];
}

export async function generateStudyPath(
  supabase: SupabaseClient,
  userId: string,
  examId: string
): Promise<StudyPath> {
  const [prediction, weakPoints, profileData, flashcardData] = await Promise.all([
    getPrediction(supabase, userId, examId),
    getWeakPoints(supabase, userId, examId, 10),
    supabase.from("profiles").select("target_exam_date").eq("id", userId).single(),
    supabase.from("flashcards").select("id").eq("user_id", userId).eq("exam_id", examId).lte("next_review_at", new Date().toISOString()),
  ]);

  const req = PASS_REQUIREMENTS[examId];
  const passTarget = req?.passingScore || 60;

  // 試験日までの日数
  let daysUntilExam: number | null = null;
  if (profileData.data?.target_exam_date) {
    const examDate = new Date(profileData.data.target_exam_date);
    daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86_400_000));
  }

  // 弱点から重点科目を特定（上位3つ）
  const focusAreas = prediction.subjectScores
    .filter((s) => s.questionsAnswered >= 2 && !s.isAbovePassLine)
    .sort((a, b) => a.gapToPassLine - b.gapToPassLine)
    .slice(0, 3)
    .map((s) => s.subject);

  // もし弱点データが足りなければ未回答科目を追加
  if (focusAreas.length < 3) {
    const unAnswered = prediction.subjectScores.filter((s) => s.questionsAnswered < 2).map((s) => s.subject);
    focusAreas.push(...unAnswered.slice(0, 3 - focusAreas.length));
  }

  // 今日のタスク生成
  const dailyTasks: StudyTask[] = [];
  const flashcardsDue = flashcardData.data?.length || 0;

  if (flashcardsDue > 0) {
    dailyTasks.push({
      type: "flashcard", subject: "復習", reason: `${flashcardsDue}枚のカードが復習期限`,
      difficulty: 3, estimatedMinutes: Math.ceil(flashcardsDue * 0.5),
    });
  }

  for (const area of focusAreas.slice(0, 2)) {
    const wp = weakPoints.find((w) => w.subject === area);
    const diff = await getRecommendedDifficulty(supabase, userId, examId, area);
    dailyTasks.push({
      type: "practice", subject: area, topic: wp?.topic,
      reason: wp ? `正答率${wp.accuracyPct}% — 強化が必要` : "未学習 — まず基礎から",
      difficulty: diff, estimatedMinutes: 15,
    });
  }

  if (dailyTasks.length < 4 && focusAreas.length > 0) {
    dailyTasks.push({
      type: "chat", subject: focusAreas[0],
      reason: "つまずきやすい論点をAIに質問",
      difficulty: 3, estimatedMinutes: 10,
    });
  }

  // 週間目標
  const weeklyGoals = prediction.subjectScores
    .filter((s) => !s.isAbovePassLine || s.questionsAnswered < 5)
    .slice(0, 5)
    .map((s) => ({
      subject: s.subject,
      targetAccuracy: Math.min(s.accuracy + 15, passTarget + 10),
      currentAccuracy: s.accuracy,
      questionsToSolve: Math.max(10, Math.ceil((passTarget - s.accuracy) * 0.5)),
    }));

  return { dailyTasks, weeklyGoals, daysUntilExam, focusAreas };
}

export async function getTodayTasks(
  supabase: SupabaseClient,
  userId: string,
  examId: string
): Promise<StudyTask[]> {
  const path = await generateStudyPath(supabase, userId, examId);
  return path.dailyTasks;
}

// ── 既存関数 ─────────────────────────────────

export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  questionsAnswered: number = 1,
  correctAnswers: number = 0
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // 今日のレコードをupsert
  const { data: existing } = await supabase
    .from("study_streaks")
    .select("*")
    .eq("user_id", userId)
    .eq("study_date", today)
    .single();

  if (existing) {
    await supabase
      .from("study_streaks")
      .update({
        questions_answered: existing.questions_answered + questionsAnswered,
        correct_answers: existing.correct_answers + correctAnswers,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("study_streaks").insert({
      user_id: userId,
      study_date: today,
      questions_answered: questionsAnswered,
      correct_answers: correctAnswers,
    });
  }

  // 連続日数を計算
  const { data: streaks } = await supabase
    .from("study_streaks")
    .select("study_date")
    .eq("user_id", userId)
    .order("study_date", { ascending: false })
    .limit(365);

  if (!streaks) return;

  let currentStreak = 0;
  const now = new Date();

  for (let i = 0; i < streaks.length; i++) {
    const expected = new Date(now);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];

    if (streaks[i].study_date === expectedStr) {
      currentStreak++;
    } else {
      break;
    }
  }

  // プロフィール更新
  const { data: profile } = await supabase
    .from("profiles")
    .select("longest_streak")
    .eq("id", userId)
    .single();

  const longestStreak = Math.max(
    currentStreak,
    profile?.longest_streak || 0
  );

  await supabase
    .from("profiles")
    .update({ current_streak: currentStreak, longest_streak: longestStreak })
    .eq("id", userId);
}
