import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getExamById } from "@/lib/exams";

export async function GET(request: NextRequest) {
  const examId = request.nextUrl.searchParams.get("exam");
  const examDate = request.nextUrl.searchParams.get("date") || null;
  const dailyGoal = parseInt(request.nextUrl.searchParams.get("goal") || "0") || null;
  const origin = request.nextUrl.origin;
  const isAjax = request.headers.get("accept")?.includes("application/json");

  if (!examId || !getExamById(examId)) {
    return isAjax
      ? NextResponse.json({ error: "invalid exam" }, { status: 400 })
      : NextResponse.redirect(`${origin}/dashboard`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return isAjax
      ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(`${origin}/login`);
  }

  const update: Record<string, unknown> = { target_exam: examId };
  if (examDate) update.target_exam_date = examDate;
  if (dailyGoal) update.daily_goal = dailyGoal;

  await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  // 学習開始を記録（exam-statusで検知するため）
  // 既にこの試験のメッセージがあればスキップ
  const { data: existing } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      exam_id: examId,
      subject: "_system",
      role: "assistant",
      content: "学習を開始しました",
    });
  }

  return isAjax
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(`${origin}/dashboard`);
}
