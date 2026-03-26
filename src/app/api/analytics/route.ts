import { createClient } from "@/lib/supabase/server";
import { getWeakPoints } from "@/lib/adaptive-engine";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(user.id, "analytics:get", RATE_LIMITS.read);
  if (limited) return limited;

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");

  if (!examId) {
    return Response.json({ error: "examId が必要です" }, { status: 400 });
  }

  // 並行で全データ取得
  const [weakPoints, practiceData, streakData, profileData] = await Promise.all([
    getWeakPoints(supabase, user.id, examId, 20),

    supabase
      .from("practice_results")
      .select("subject, topic, is_correct, difficulty, created_at")
      .eq("user_id", user.id)
      .eq("exam_id", examId)
      .order("created_at", { ascending: true }),

    supabase
      .from("study_streaks")
      .select("*")
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(30),

    supabase
      .from("profiles")
      .select("current_streak, longest_streak, daily_goal")
      .eq("id", user.id)
      .single(),
  ]);

  const results = practiceData.data || [];

  // 科目別正答率
  const subjectStats: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    if (!subjectStats[r.subject]) subjectStats[r.subject] = { total: 0, correct: 0 };
    subjectStats[r.subject].total++;
    if (r.is_correct) subjectStats[r.subject].correct++;
  }

  const subjectAccuracy = Object.entries(subjectStats).map(([subject, s]) => ({
    subject,
    total: s.total,
    correct: s.correct,
    accuracy: Math.round((s.correct / s.total) * 100),
  }));

  // 日別スコア推移（直近30日）
  const dailyScores: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    const date = new Date(r.created_at).toISOString().split("T")[0];
    if (!dailyScores[date]) dailyScores[date] = { total: 0, correct: 0 };
    dailyScores[date].total++;
    if (r.is_correct) dailyScores[date].correct++;
  }

  const scoreHistory = Object.entries(dailyScores)
    .map(([date, s]) => ({
      date,
      total: s.total,
      correct: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  // 総合統計
  const totalQuestions = results.length;
  const totalCorrect = results.filter((r) => r.is_correct).length;
  const overallAccuracy = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  return Response.json({
    overview: {
      totalQuestions,
      totalCorrect,
      overallAccuracy,
      currentStreak: profileData.data?.current_streak || 0,
      longestStreak: profileData.data?.longest_streak || 0,
      dailyGoal: profileData.data?.daily_goal || 10,
    },
    subjectAccuracy,
    weakPoints,
    scoreHistory,
    recentStreaks: streakData.data || [],
  });
}
