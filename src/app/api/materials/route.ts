import { createClient } from "@/lib/supabase/server";
import {
  createMaterialForUser,
  deleteMaterialForUser,
  listMaterialsForUser,
} from "@/lib/materials-store";
import { materialsDeleteSchema, materialsPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  if (!examId) return Response.json({ materials: [] });

  try {
    const materials = await listMaterialsForUser(supabase as any, user.id, examId);
    return Response.json({ materials });
  } catch (error) {
    console.error("materials GET error:", error);
    return Response.json({ error: "教材一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "materials:post", RATE_LIMITS.write);
  if (limited) return limited;

  const body = await request.json();
  const parsed = parseBody(materialsPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { count, error: countError } = await supabase
    .from("user_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    console.error("materials count error:", countError);
    return Response.json({ error: "教材数の確認に失敗しました" }, { status: 500 });
  }

  if ((count || 0) > 5000) {
    return Response.json(
      { error: "教材数の上限に達しました。不要な教材を削除してください。" },
      { status: 400 }
    );
  }

  try {
    const material = await createMaterialForUser(supabase as any, {
      userId: user.id,
      ...parsed.data,
    });

    return Response.json({
      ok: true,
      material,
      title: material.title,
      chunks: material.totalChunks,
      chars: material.totalChars,
    });
  } catch (error) {
    console.error("materials POST error:", error);
    const message = error instanceof Error ? error.message : "教材の処理中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json();
  const parsed = parseBody(materialsDeleteSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  if (!parsed.data.id) {
    return Response.json({ error: "削除対象の教材IDが必要です" }, { status: 400 });
  }

  try {
    const deleted = await deleteMaterialForUser(supabase as any, user.id, parsed.data.id);
    if (!deleted) {
      return Response.json({ error: "教材が見つかりません" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("materials DELETE error:", error);
    return Response.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
