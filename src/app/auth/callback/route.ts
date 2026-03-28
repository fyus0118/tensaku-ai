import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/dashboard";

  let isRecovery = type === "recovery";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login`);
    }

    // recovery_sent_atが10分以内ならリカバリーフロー
    if (!isRecovery && data.user?.recovery_sent_at) {
      const elapsed = Date.now() - new Date(data.user.recovery_sent_at).getTime();
      if (elapsed < 10 * 60 * 1000) {
        isRecovery = true;
      }
    }
  }

  if (isRecovery) {
    const res = NextResponse.redirect(`${origin}/auth/reset-password`);
    res.cookies.set("recovery_pending", "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.redirect(`${origin}${next}`);
}
