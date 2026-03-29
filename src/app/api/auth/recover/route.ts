import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://studyengines.com";

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "サーバー設定エラー", debug: `url:${!!supabaseUrl} key:${!!serviceRoleKey}` },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback`,
    });

    if (error) {
      return NextResponse.json(
        { error: "メール送信に失敗しました", debug: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "予期しないエラー", debug: msg }, { status: 500 });
  }
}
