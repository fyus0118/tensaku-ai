import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login`);
    }
  }

  // recoveryの判定: URLパラメータ or cookie
  const cookies = request.headers.get("cookie") || "";
  const isRecovery = type === "recovery" || cookies.includes("recovery_pending=1");

  if (isRecovery) {
    const res = NextResponse.redirect(`${origin}/auth/reset-password`);
    // cookieをクリア
    res.cookies.set("recovery_pending", "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.redirect(`${origin}${next}`);
}
