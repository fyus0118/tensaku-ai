import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { chunkText, embedTexts } from "@/lib/rag/embeddings";
import { materialsPostSchema, materialsDeleteSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET: ユーザーの教材一覧を取得
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  if (!examId) return Response.json({ materials: [] });

  // titleごとにグルーピングして返す
  const { data: docs, error } = await supabase
    .from("user_documents")
    .select("id, title, subject, topic, content, chunk_index, total_chunks, created_at")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("user_documents fetch error:", error);
    return Response.json({ error: "取得に失敗しました" }, { status: 500 });
  }

  // title単位でまとめる
  const grouped = new Map<string, {
    title: string;
    subject: string;
    topic: string | null;
    totalChunks: number;
    totalChars: number;
    createdAt: string;
  }>();

  for (const doc of docs || []) {
    const key = `${doc.title}__${doc.subject}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.totalChunks++;
      existing.totalChars += doc.content.length;
    } else {
      grouped.set(key, {
        title: doc.title,
        subject: doc.subject,
        topic: doc.topic,
        totalChunks: doc.total_chunks,
        totalChars: doc.content.length,
        createdAt: doc.created_at,
      });
    }
  }

  return Response.json({ materials: Array.from(grouped.values()) });
}

// POST: テキストを受け取り、チャンク化→embedding→保存
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "materials:post", RATE_LIMITS.write);
  if (limited) return limited;

  const body = await request.json();
  const parsed = parseBody(materialsPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, topic, title, content } = parsed.data;
  const materialTitle = title || `${subject}${topic ? ` > ${topic}` : ""} の教材`;

  // チャンク分割
  const chunks = chunkText(content, 1000, 200);
  if (chunks.length === 0) {
    return Response.json({ error: "テキストが短すぎます" }, { status: 400 });
  }

  // 上限チェック（1教材あたり最大200チャンク ≒ 20万文字）
  if (chunks.length > 200) {
    return Response.json({ error: "テキストが長すぎます。20万文字以内にしてください。" }, { status: 400 });
  }

  // ユーザーの総教材数チェック（最大50教材）
  const { count } = await supabase
    .from("user_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count || 0) > 5000) {
    return Response.json({ error: "教材数の上限に達しました。不要な教材を削除してください。" }, { status: 400 });
  }

  try {
    // embedding生成（バッチ）
    const embeddings = await embedTexts(chunks);

    // Supabaseに保存（service roleでembedding書き込み）
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const rows = chunks.map((chunk, idx) => ({
      user_id: user.id,
      exam_id: examId,
      subject,
      topic: topic || null,
      title: materialTitle,
      content: chunk,
      embedding: JSON.stringify(embeddings[idx]),
      chunk_index: idx,
      total_chunks: chunks.length,
      metadata: {},
    }));

    const { error: insertError } = await adminClient
      .from("user_documents")
      .insert(rows);

    if (insertError) {
      console.error("user_documents insert error:", insertError);
      return Response.json({ error: "保存に失敗しました" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      title: materialTitle,
      chunks: chunks.length,
      chars: content.length,
    });
  } catch (err) {
    console.error("materials processing error:", err);
    return Response.json({ error: "教材の処理中にエラーが発生しました" }, { status: 500 });
  }
}

// DELETE: 教材を削除（title単位）
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json();
  const parsed = parseBody(materialsDeleteSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { title, examId } = parsed.data;

  const { error } = await supabase
    .from("user_documents")
    .delete()
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("title", title);

  if (error) {
    console.error("user_documents delete error:", error);
    return Response.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
