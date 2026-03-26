import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import Stripe from "stripe";

// Webhook用にSupabaseをService Roleで作成
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

// 処理済みイベントIDを記録（冪等性保証）
const processedEvents = new Set<string>();

// 古いイベントIDを1時間ごとに掃除（メモリリーク防止）
setInterval(() => {
  processedEvents.clear();
}, 3_600_000);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 冪等性チェック: 同じイベントを二重処理しない
  if (processedEvents.has(event.id)) {
    return Response.json({ received: true, deduplicated: true });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId);

        if (profiles && profiles.length > 0) {
          const { error } = await supabase
            .from("profiles")
            .update({
              plan: "pro",
              stripe_subscription_id: subscriptionId,
            })
            .eq("id", profiles[0].id);

          if (error) {
            // DB更新失敗 → Stripeにリトライさせる（500を返す）
            console.error("[webhook] checkout.session.completed DB error:", error);
            return Response.json({ error: "DB update failed" }, { status: 500 });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId);

        if (profiles && profiles.length > 0) {
          const { error } = await supabase
            .from("profiles")
            .update({
              plan: "free",
              stripe_subscription_id: null,
            })
            .eq("id", profiles[0].id);

          if (error) {
            console.error("[webhook] subscription.deleted DB error:", error);
            return Response.json({ error: "DB update failed" }, { status: 500 });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const isActive = ["active", "trialing"].includes(subscription.status);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId);

        if (profiles && profiles.length > 0) {
          const { error } = await supabase
            .from("profiles")
            .update({
              plan: isActive ? "pro" : "free",
            })
            .eq("id", profiles[0].id);

          if (error) {
            console.error("[webhook] subscription.updated DB error:", error);
            return Response.json({ error: "DB update failed" }, { status: 500 });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        // 支払い失敗通知 — ログを残す（将来的にメール通知を追加可能）
        const invoice = event.data.object as Stripe.Invoice;
        console.error("[webhook] payment failed for customer:", invoice.customer);
        break;
      }
    }

    // 成功時のみ処理済みとしてマーク
    processedEvents.add(event.id);
    return Response.json({ received: true });
  } catch (err) {
    // 予期しないエラー → Stripeにリトライさせる
    console.error("[webhook] unexpected error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
