import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const examId = request.nextUrl.searchParams.get("exam");
  if (!examId) return Response.json({ hasData: false });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ hasData: false });

  const [practiceRes, chatRes, streakRes] = await Promise.all([
    supabase
      .from("practice_results")
      .select("is_correct, subject, created_at")
      .eq("user_id", user.id)
      .eq("exam_id", examId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("chat_messages")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("exam_id", examId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("study_streaks")
      .select("study_date, questions_answered, correct_answers")
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(1),
  ]);

  const results = practiceRes.data || [];
  const totalQuestions = results.length;

  if (totalQuestions === 0 && (!chatRes.data || chatRes.data.length === 0)) {
    return Response.json({ hasData: false });
  }

  const correctCount = results.filter(r => r.is_correct).length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // 科目別集計
  const subjectStats: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    const s = r.subject || "その他";
    if (!subjectStats[s]) subjectStats[s] = { total: 0, correct: 0 };
    subjectStats[s].total++;
    if (r.is_correct) subjectStats[s].correct++;
  }

  // 弱点トップ3
  const weakPoints = Object.entries(subjectStats)
    .map(([subject, stats]) => ({
      subject,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      total: stats.total,
    }))
    .filter(w => w.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // 最終学習日
  const lastDates = [
    results[0]?.created_at,
    chatRes.data?.[0]?.created_at,
  ].filter(Boolean).sort().reverse();
  const lastStudiedAt = lastDates[0] || null;

  return Response.json({
    hasData: true,
    totalQuestions,
    accuracy,
    weakPoints,
    lastStudiedAt,
    currentStreak: streakRes.data?.[0]?.questions_answered || 0,
  });
}
