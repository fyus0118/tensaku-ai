import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // パスワードリセットフローの場合、reset-passwordページに飛ばす
  const isRecovery = request.cookies.get("sb-recovery")?.value === "1";
  const redirectUrl = isRecovery ? "/auth/reset-password" : next;

  const response = NextResponse.redirect(`${origin}${redirectUrl}`);
  if (isRecovery) {
    response.cookies.delete("sb-recovery");
  }
  return response;
}
