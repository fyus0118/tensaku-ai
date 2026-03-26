import { createClient } from "@/lib/supabase/server";
import { getPrediction, generateStudyPath, getTodayTasks } from "@/lib/adaptive-engine";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(user.id, "prediction:get", RATE_LIMITS.read);
  if (limited) return limited;

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");

  if (!examId) {
    return Response.json({ error: "examId が必要です" }, { status: 400 });
  }

  const [prediction, studyPath, todayTasks] = await Promise.all([
    getPrediction(supabase, user.id, examId),
    generateStudyPath(supabase, user.id, examId),
    getTodayTasks(supabase, user.id, examId),
  ]);

  return Response.json({ prediction, studyPath, todayTasks });
}
