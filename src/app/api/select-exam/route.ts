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

  return isAjax
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(`${origin}/dashboard`);
}
