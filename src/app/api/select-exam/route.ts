import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getExamById } from "@/lib/exams";

export async function GET(request: NextRequest) {
  const examId = request.nextUrl.searchParams.get("exam");
  const origin = request.nextUrl.origin;

  if (!examId || !getExamById(examId)) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  await supabase
    .from("profiles")
    .update({ target_exam: examId })
    .eq("id", user.id);

  return NextResponse.redirect(`${origin}/dashboard`);
}
