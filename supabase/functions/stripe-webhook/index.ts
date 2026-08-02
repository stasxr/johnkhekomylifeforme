// =====================================================================
//  Supabase Edge Function: stripe-webhook
//  Ловит событие оплаты от Stripe и ставит is_supporter = true
//  тому пользователю, чей user_id пришёл в client_reference_id.
//
//  Секреты (задать: supabase secrets set ... или в дашборде):
//    STRIPE_SECRET_KEY          — НОВЫЙ секретный ключ Stripe (sk_live_...)
//    STRIPE_WEBHOOK_SECRET      — signing secret из настроек webhook Stripe
//    SUPABASE_URL               — обычно уже задан
//    SUPABASE_SERVICE_ROLE_KEY  — service_role ключ (Settings → API)
//  Минимальная сумма для доступа — 10 EUR (1000 центов).
// =====================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MIN_AMOUNT_CENTS = 1000; // 10 EUR

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("no signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("signature check failed:", err.message);
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const userId = s.client_reference_id;
    const amount = s.amount_total ?? 0;
    const paid = s.payment_status === "paid";

    if (paid && userId && amount >= MIN_AMOUNT_CENTS) {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: userId, is_supporter: true, supported_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) {
        console.error("db update failed:", error.message);
        return new Response("db error", { status: 500 });
      }
      console.log("supporter unlocked:", userId, amount);
    } else {
      console.log("ignored session", { paid, userId, amount });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
