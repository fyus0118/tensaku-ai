import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://studyengines.com";

  // Admin APIでリカバリーリンク生成（レート制限なし）
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/auth/reset-password`,
    },
  });

  if (error) {
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }

  // Supabase内蔵メール送信をトリガー（Admin APIのrecoverエンドポイント）
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        email,
        gotrue_meta_security: { captcha_token: "" },
      }),
    }
  );

  // recoverエンドポイントもレート制限される可能性がある
  // その場合はgenerateLinkで生成したリンクのaction_linkを返す
  if (!res.ok) {
    // フォールバック: リンクを直接返してクライアント側でリダイレクト
    return NextResponse.json({
      action_link: data.properties?.action_link,
      fallback: true,
    });
  }

  return NextResponse.json({ success: true });
}
