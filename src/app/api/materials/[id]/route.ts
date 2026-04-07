import { createClient } from "@/lib/supabase/server";
import {
  deleteMaterialForUser,
  getMaterialDetailForUser,
  updateMaterialForUser,
} from "@/lib/materials-store";
import { materialsPatchSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;

  try {
    const material = await getMaterialDetailForUser(supabase as any, user.id, id);
    if (!material) {
      return Response.json({ error: "教材が見つかりません" }, { status: 404 });
    }
    return Response.json({ material });
  } catch (error) {
    console.error("material detail GET error:", error);
    return Response.json({ error: "教材の取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "materials:patch", RATE_LIMITS.write);
  if (limited) return limited;

  const { id } = await params;
  const body = await request.json();
  const parsed = parseBody(materialsPatchSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const material = await updateMaterialForUser(supabase as any, user.id, id, {
      userId: user.id,
      ...parsed.data,
    });

    if (!material) {
      return Response.json({ error: "教材が見つかりません" }, { status: 404 });
    }

    return Response.json({ ok: true, material });
  } catch (error) {
    console.error("material PATCH error:", error);
    const message = error instanceof Error ? error.message : "教材の更新に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;

  try {
    const deleted = await deleteMaterialForUser(supabase as any, user.id, id);
    if (!deleted) {
      return Response.json({ error: "教材が見つかりません" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("material DELETE error:", error);
    return Response.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
