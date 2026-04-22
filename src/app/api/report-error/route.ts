import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const { examId, topic, message } = await request.json();
  if (!examId || !message) return Response.json({ error: "入力が不正です" }, { status: 400 });

  await supabase.from("error_reports").insert({
    user_id: user.id,
    exam_id: examId,
    topic: topic || null,
    message,
  });

  return Response.json({ ok: true });
}
