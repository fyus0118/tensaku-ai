import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/textbook?examId=takken&subject=民法&topic=物権変動（意思主義・176条）
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("examId");
  if (!examId) return NextResponse.json({ error: "examId required" }, { status: 400 });

  const subject = searchParams.get("subject");
  const topic = searchParams.get("topic");

  // topic指定 → そのトピックの全チャンクを結合して返す
  if (topic) {
    const { data, error } = await supabase
      .from("documents")
      .select("content, metadata")
      .eq("exam_id", examId)
      .eq("topic", topic)
      .order("metadata->chunkIndex", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fullContent = (data || []).map((d) => d.content).join("\n\n");

    const { data: illustrations } = await supabase
      .from("material_illustrations")
      .select("image_url, caption, position, sort_order")
      .eq("exam_id", examId)
      .eq("topic", topic)
      .order("sort_order", { ascending: true });

    return NextResponse.json({
      topic,
      content: fullContent,
      chunks: data?.length || 0,
      illustrations: illustrations || [],
    });
  }

  // subject指定 → そのsubjectのトピック一覧
  // subject未指定 → 全subjectとトピック一覧
  let query = supabase
    .from("documents")
    .select("subject, topic")
    .eq("exam_id", examId);

  if (subject) {
    query = query.eq("subject", subject);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate and group by subject
  const subjectMap = new Map<string, Set<string>>();
  for (const row of data || []) {
    if (!row.subject || !row.topic) continue;
    if (!subjectMap.has(row.subject)) subjectMap.set(row.subject, new Set());
    subjectMap.get(row.subject)!.add(row.topic);
  }

  const subjects = Array.from(subjectMap.entries()).map(([name, topics]) => ({
    name,
    topics: Array.from(topics),
  }));

  return NextResponse.json({ subjects });
}
