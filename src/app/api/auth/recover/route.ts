import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://studyengines.com";

  // Admin APIでリカバリーリンク生成（レート制限なし）
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      type: "recovery",
      redirect_to: `${appUrl}/auth/reset-password`,
    }),
  });

  if (!linkRes.ok) {
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }

  const linkData = await linkRes.json();
  const actionLink = linkData.action_link;

  if (!actionLink) {
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }

  // Supabaseのrecoverエンドポイントでメール送信を試みる
  const mailRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!mailRes.ok) {
    // メール送信がレート制限された場合、リンクに直接遷移
    return NextResponse.json({ action_link: actionLink, fallback: true });
  }

  return NextResponse.json({ success: true });
}
