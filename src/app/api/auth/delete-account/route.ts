import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";

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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // プロフィール取得（Stripe顧客IDを確認）
  const { data: profile } = await adminClient
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  // Stripeサブスクリプションをキャンセル
  if (profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch (err) {
      console.error("Stripeサブスクリプションキャンセルエラー:", err);
    }
  }

  // 全ユーザーデータを削除（RLSで本人のデータのみ）
  await Promise.all([
    adminClient.from("chat_messages").delete().eq("user_id", user.id),
    adminClient.from("practice_results").delete().eq("user_id", user.id),
    adminClient.from("flashcards").delete().eq("user_id", user.id),
    adminClient.from("reviews").delete().eq("user_id", user.id),
    adminClient.from("study_streaks").delete().eq("user_id", user.id),
    adminClient.from("profiles").delete().eq("id", user.id),
  ]);

  // Supabase Authユーザーを削除
  await adminClient.auth.admin.deleteUser(user.id);

  return Response.json({ ok: true });
}
