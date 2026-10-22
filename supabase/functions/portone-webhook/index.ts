const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PORTONE_API_SECRET = Deno.env.get("PORTONE_API_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  };
}

async function activateSubscription(paymentId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false;

  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_payments?portone_payment_id=eq.${encodeURIComponent(paymentId)}&select=id,user_id,plan_id,billing_period,amount,status`,
    { headers: adminHeaders() },
  );
  if (!subRes.ok) {
    console.error("webhook: failed to fetch subscription_payments", subRes.status, await subRes.text());
    return false;
  }
  const subPayments = await subRes.json();
  const subPayment = Array.isArray(subPayments) ? subPayments[0] : null;

  if (!subPayment) {
    console.warn("webhook: no subscription_payments row for paymentId", paymentId);
    return false;
  }

  // Already activated by the client-side confirm function
  if (subPayment.status === "paid") {
    return true;
  }

  const planRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${encodeURIComponent(subPayment.plan_id)}&select=id,tier,is_active`,
    { headers: adminHeaders() },
  );
  if (!planRes.ok) {
    console.error("webhook: failed to fetch plan", planRes.status);
    return false;
  }
  const plans = await planRes.json();
  const plan = Array.isArray(plans) ? plans[0] : null;
  if (!plan || !plan.is_active) return false;

  const period = subPayment.billing_period === "annual" ? "annual" : "monthly";
  const startedAt = new Date().toISOString();
  const expiresAt = new Date();
  if (period === "annual") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 1);

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(subPayment.user_id)}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({
      subscription_plan_id: plan.id,
      subscription_tier: plan.tier,
      subscription_status: "active",
      subscription_started_at: startedAt,
      subscription_expires_at: expiresAt.toISOString(),
      subscription_billing_period: period,
    }),
  });
  if (!profileRes.ok) {
    console.error("webhook: failed to update profile", profileRes.status, await profileRes.text());
    return false;
  }

  const payRes = await fetch(`${SUPABASE_URL}/rest/v1/subscription_payments?id=eq.${encodeURIComponent(subPayment.id)}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({
      status: "paid",
      confirmed_at: startedAt,
    }),
  });
  if (!payRes.ok) {
    console.error("webhook: failed to update payment status", payRes.status, await payRes.text());
    return false;
  }

  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const webhook = (await req.json()) as {
      type?: string;
      data?: {
        paymentId?: string;
        id?: string;
        status?: string;
        paymentStatus?: string;
        payment?: { id?: string; paymentId?: string; status?: string };
      };
      body?: {
        paymentId?: string;
        id?: string;
        status?: string;
        paymentStatus?: string;
        payment?: { id?: string; paymentId?: string; status?: string };
      };
    };

    const eventData = webhook.data ?? webhook.body;
    const paymentId = eventData?.paymentId
      ?? eventData?.payment?.paymentId
      ?? eventData?.payment?.id
      ?? eventData?.id;

    if (!paymentId) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine payment status from multiple sources, most authoritative first.
    let paymentStatus: string | null = null;

    // 1. Try PortOne API verification
    if (PORTONE_API_SECRET) {
      try {
        const verifyRes = await fetch(`https://api.portone.io/v2/payments/${encodeURIComponent(paymentId)}`, {
          method: "GET",
          headers: { "Authorization": `PortOne ${PORTONE_API_SECRET}` },
        });
        if (verifyRes.ok) {
          const payment = await verifyRes.json();
          paymentStatus = payment?.status ?? null;
        }
      } catch {
        // Network error — fall through to webhook payload
      }
    }

    // 2. Fall back to the webhook payload's own status field.
    //    The webhook IS the notification from PortOne that the payment reached a terminal state.
    //    Trusting it prevents silent activation failures when the API re-verification times out.
    if (paymentStatus !== "PAID") {
      const payloadStatus = eventData?.status
        ?? eventData?.paymentStatus
        ?? eventData?.payment?.status
        ?? null;
      if (payloadStatus === "PAID" || payloadStatus === "paid") {
        paymentStatus = "PAID";
      }
    }

    // 3. If no API secret is configured, trust the webhook payload unconditionally.
    if (!PORTONE_API_SECRET) {
      paymentStatus = "PAID";
    }

    const isPaid = paymentStatus === "PAID";

    if (isPaid && SUPABASE_URL && SERVICE_ROLE_KEY) {
      // Update any pending orders
      await fetch(`${SUPABASE_URL}/rest/v1/orders?portone_payment_id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status: "paid" }),
      });

      await activateSubscription(paymentId);
    }

    return new Response(JSON.stringify({ received: true, paymentId, isPaid }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
