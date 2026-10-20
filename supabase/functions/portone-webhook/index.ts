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
    `${SUPABASE_URL}/rest/v1/subscription_payments?portone_payment_id=eq.${encodeURIComponent(paymentId)}&status=eq.pending&select=id,user_id,plan_id,billing_period,amount`,
    { headers: adminHeaders() },
  );
  const subPayments = await subRes.json();
  const subPayment = Array.isArray(subPayments) ? subPayments[0] : null;

  if (subPayment) {
    const planRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${encodeURIComponent(subPayment.plan_id)}&select=id,tier,is_active`,
      { headers: adminHeaders() },
    );
    const plans = await planRes.json();
    const plan = Array.isArray(plans) ? plans[0] : null;
    if (!plan || !plan.is_active) return false;

    const period = subPayment.billing_period === "annual" ? "annual" : "monthly";
    const startedAt = new Date().toISOString();
    const expiresAt = new Date();
    if (period === "annual") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else expiresAt.setMonth(expiresAt.getMonth() + 1);

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(subPayment.user_id)}`, {
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

    await fetch(`${SUPABASE_URL}/rest/v1/subscription_payments?id=eq.${encodeURIComponent(subPayment.id)}`, {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify({
        status: "paid",
        confirmed_at: startedAt,
      }),
    });

    return true;
  }

  return false;
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

    let paymentStatus: string | null = null;
    if (PORTONE_API_SECRET) {
      try {
        const verifyRes = await fetch(`https://api.portone.io/v2/payments/${encodeURIComponent(paymentId)}`, {
          method: "GET",
          headers: { "Authorization": `PortOne ${PORTONE_API_SECRET}` },
        });
        const payment = await verifyRes.json();
        paymentStatus = payment?.status ?? null;
      } catch {
        // 검증 실패 시 웹훅 데이터 신뢰
      }
    }

    const isPaid = paymentStatus === "PAID" || !PORTONE_API_SECRET;

    if (isPaid && SUPABASE_URL && SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/orders?portone_payment_id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status: "paid" }),
      });

      await activateSubscription(paymentId);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
