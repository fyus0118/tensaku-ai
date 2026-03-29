import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://studyengines.com";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[recover] Missing env vars:", { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
    return NextResponse.json({ error: "サーバー設定エラー", debug: "missing env vars" }, { status: 500 });
  }

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
      redirect_to: `${appUrl}/auth/callback`,
    }),
  });

  const linkBody = await linkRes.text();
  console.log("[recover] generate_link status:", linkRes.status, "body:", linkBody);

  if (!linkRes.ok) {
    return NextResponse.json({ error: "エラーが発生しました", debug: linkBody }, { status: 500 });
  }

  const linkData = JSON.parse(linkBody);
  const actionLink = linkData.action_link;

  if (!actionLink) {
    return NextResponse.json({ error: "エラーが発生しました", debug: "no action_link" }, { status: 500 });
  }

  // Supabaseのrecoverエンドポイントでメール送信
  const mailRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      redirect_to: `${appUrl}/auth/callback`,
    }),
  });

  const mailBody = await mailRes.text();
  console.log("[recover] recover status:", mailRes.status, "body:", mailBody);

  if (!mailRes.ok) {
    // メール送信がレート制限された場合、リンクに直接遷移
    return NextResponse.json({ action_link: actionLink, fallback: true, debug: mailBody });
  }

  return NextResponse.json({ success: true });
}
