import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getExamById } from "@/lib/exams";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam");

  if (!examId || !getExamById(examId)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("profiles")
    .update({ target_exam: examId })
    .eq("id", user.id);

  redirect("/dashboard");
}
