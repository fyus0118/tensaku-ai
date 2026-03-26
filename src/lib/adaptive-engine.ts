import type { SupabaseClient } from "@supabase/supabase-js";

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
