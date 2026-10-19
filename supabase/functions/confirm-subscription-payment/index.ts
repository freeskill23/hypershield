import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET") ?? "";
const portoneStoreId = Deno.env.get("VITE_PORTONE_STORE_ID") ?? Deno.env.get("PORTONE_STORE_ID") ?? "";

interface PaymentRequest {
  paymentId: string;
  planId: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "결제를 확인할 수 없습니다." }, 401);
    }

    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return json({ error: "로그인이 필요합니다." }, 401);
    }

    const body = (await req.json()) as Partial<PaymentRequest>;
    if (!body.paymentId || !body.planId || !portoneApiSecret || !portoneStoreId) {
      return json({ error: "결제 정보가 올바르지 않습니다." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id, name, monthly_price, tier, is_active")
      .eq("id", body.planId)
      .maybeSingle();

    if (planError || !plan || !plan.is_active) {
      return json({ error: "구독 상품을 확인할 수 없습니다." }, 400);
    }

    const paymentResponse = await fetch(
      `https://api.portone.io/v2/payments/${encodeURIComponent(body.paymentId)}`,
      {
        headers: {
          Authorization: `PortOne ${portoneApiSecret}`,
          "Content-Type": "application/json",
        },
      },
    );
    const payment = await paymentResponse.json().catch(() => null);
    const paidAmount = payment?.amount?.total;
    const isPaid = paymentResponse.ok && payment?.status === "PAID";

    if (!isPaid || payment?.storeId !== portoneStoreId || paidAmount !== plan.monthly_price) {
      return json({ error: "결제 확인에 실패했습니다. 결제가 완료되었는지 확인해 주세요." }, 400);
    }

    const userId = userData.user.id;
    const { data: existingPayment } = await adminClient
      .from("subscription_payments")
      .select("id, user_id, status")
      .eq("portone_payment_id", body.paymentId)
      .maybeSingle();

    if (existingPayment?.status === "paid") {
      return json({ ok: true, expiresAt: null });
    }
    if (existingPayment && existingPayment.user_id !== userId) {
      return json({ error: "결제를 확인할 수 없습니다." }, 400);
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        subscription_plan_id: plan.id,
        subscription_tier: plan.tier,
        subscription_status: "active",
        subscription_started_at: startedAt.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      return json({ error: "구독 활성화에 실패했습니다." }, 500);
    }

    const paymentRecord = {
      user_id: userId,
      plan_id: plan.id,
      portone_payment_id: body.paymentId,
      amount: plan.monthly_price,
      status: "paid",
      error_message: null,
    };

    const { error: paymentRecordError } = existingPayment
      ? await adminClient.from("subscription_payments").update(paymentRecord).eq("id", existingPayment.id)
      : await adminClient.from("subscription_payments").insert(paymentRecord);

    if (paymentRecordError) {
      return json({ error: "결제 기록을 저장하지 못했습니다." }, 500);
    }

    return json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error("confirm subscription payment error", error);
    return json({ error: "결제 확인 중 문제가 발생했습니다." }, 500);
  }
});
