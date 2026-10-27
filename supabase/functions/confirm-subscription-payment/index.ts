import { createClient } from "npm:@supabase/supabase-js@2.57.4";
// v2: retry PortOne verification to handle timing issues

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET") ?? "";

type BillingPeriod = "monthly" | "annual";

interface PaymentRequest {
  paymentId: string;
  planId: string;
  period: BillingPeriod;
  amount: number;
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
    if (!body.paymentId) {
      return json({ error: "결제 정보가 올바르지 않습니다." }, 400);
    }

    const userId = userData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingPayment } = await adminClient
      .from("subscription_payments")
      .select("id, user_id, status, plan_id, billing_period, amount, payment_method")
      .eq("portone_payment_id", body.paymentId)
      .maybeSingle();

    if (existingPayment?.status === "paid") {
      // Webhook already activated — return success with the profile's current expiry
      const { data: curProfile } = await adminClient
        .from("profiles")
        .select("subscription_expires_at, subscription_billing_period")
        .eq("id", userId)
        .maybeSingle();
      return json({ ok: true, expiresAt: curProfile?.subscription_expires_at ?? null, alreadyConfirmed: true, period: curProfile?.subscription_billing_period ?? null });
    }
    if (existingPayment && existingPayment.user_id !== userId) {
      return json({ error: "결제를 확인할 수 없습니다." }, 400);
    }

    const planId = existingPayment?.plan_id ?? body.planId;
    const period: BillingPeriod = (existingPayment?.billing_period as BillingPeriod) ?? (body.period === "annual" ? "annual" : "monthly");

    if (!planId) {
      return json({ error: "구독 상품 정보를 찾을 수 없습니다." }, 400);
    }

    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id, name, monthly_price, annual_price, tier, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan || !plan.is_active) {
      return json({ error: "구독 상품을 확인할 수 없습니다." }, 400);
    }

    const expectedAmount = period === "annual" ? plan.annual_price : plan.monthly_price;
    if (!expectedAmount || expectedAmount <= 0) {
      return json({ error: "선택한 결제 주기의 가격이 설정되어 있지 않습니다." }, 400);
    }

    let portoneVerified = false;
    let verifiedAmount: number | null = null;

    if (portoneApiSecret) {
      for (let attempt = 0; attempt < 8 && !portoneVerified; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(3000 * attempt, 12000)));
          const paymentResponse = await fetch(
            `https://api.portone.io/v2/payments/${encodeURIComponent(body.paymentId)}`,
            { headers: { Authorization: `PortOne ${portoneApiSecret}` } },
          );
          const payment = await paymentResponse.json().catch(() => null);
          const paidAmount = payment?.amount?.total;
          if (paymentResponse.ok && payment?.status === "PAID") {
            portoneVerified = true;
            verifiedAmount = typeof paidAmount === "number" ? paidAmount : null;
          }
        } catch {
          // 재시도 루프에서 계속
        }
      }
    }

    if (portoneVerified && verifiedAmount !== null && verifiedAmount !== expectedAmount) {
      return json({ error: "결제 금액이 일치하지 않습니다. 관리자에게 문의해 주세요." }, 400);
    }

    if (!portoneVerified) {
      if (existingPayment?.payment_method === "bank_transfer") {
        return json({ error: "무통장 입금은 관리자가 입금 확인 후 활성화됩니다." }, 400);
      }
      // Fallback: the webhook may have already activated the subscription while we were retrying.
      const { data: curPayment } = await adminClient
        .from("subscription_payments")
        .select("status")
        .eq("portone_payment_id", body.paymentId)
        .maybeSingle();
      if (curPayment?.status === "paid") {
        const { data: curProfile } = await adminClient
          .from("profiles")
          .select("subscription_expires_at, subscription_billing_period")
          .eq("id", userId)
          .maybeSingle();
        return json({ ok: true, expiresAt: curProfile?.subscription_expires_at ?? null, alreadyConfirmed: true, period: curProfile?.subscription_billing_period ?? null });
      }
      const reason = portoneApiSecret
        ? `결제가 완료되지 않았거나 결제 검증에 실패했습니다 (paymentId: ${body.paymentId}). 잠시 후 다시 시도해 주세요.`
        : "결제 검증 설정이 누락되어 있습니다. 관리자에게 문의해 주세요.";
      return json({ error: reason }, 400);
    }

    const now = new Date();
    const { data: curProfile } = await adminClient
      .from("profiles")
      .select("subscription_expires_at, subscription_billing_period, subscription_tier, subscription_status")
      .eq("id", userId)
      .maybeSingle();

    let baseDate = now;
    if (curProfile?.subscription_status !== 'inactive' && curProfile?.subscription_expires_at) {
      const currentExpiry = new Date(curProfile.subscription_expires_at);
      if (currentExpiry > now) baseDate = currentExpiry;
    }

    const expiresAt = new Date(baseDate);
    if (period === "annual") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        subscription_plan_id: plan.id,
        subscription_tier: plan.tier,
        subscription_status: "active",
        subscription_started_at: now.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        subscription_billing_period: period,
      })
      .eq("id", userId);

    if (profileError) {
      return json({ error: "구독 활성화에 실패했습니다." }, 500);
    }

    const paymentRecord = {
      user_id: userId,
      plan_id: plan.id,
      portone_payment_id: body.paymentId,
      amount: expectedAmount,
      status: "paid",
      billing_period: period,
      payment_method: "card",
      error_message: null,
    };

    const { error: paymentRecordError } = existingPayment
      ? await adminClient.from("subscription_payments").update({ ...paymentRecord, confirmed_at: now.toISOString() }).eq("id", existingPayment.id)
      : await adminClient.from("subscription_payments").insert(paymentRecord);

    if (paymentRecordError) {
      return json({ error: "결제 기록을 저장하지 못했습니다." }, 500);
    }

    return json({ ok: true, expiresAt: expiresAt.toISOString(), period });
  } catch (error) {
    console.error("confirm subscription payment error", error);
    return json({ error: "결제 확인 중 문제가 발생했습니다." }, 500);
  }
});
