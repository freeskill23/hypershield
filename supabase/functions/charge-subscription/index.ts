const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PORTONE_API_SECRET = Deno.env.get("PORTONE_API_SECRET") ?? "";
const PORTONE_STORE_ID = Deno.env.get("VITE_PORTONE_STORE_ID") ?? Deno.env.get("PORTONE_STORE_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ChargeRequest {
  userId: string;
  planId: string;
  billingKey: string;
  paymentId: string;
  amount: number;
  orderName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ChargeRequest;
    const { userId, planId, billingKey, paymentId, amount, orderName } = body;

    if (!billingKey || !paymentId || !amount) {
      return new Response(JSON.stringify({ error: "필수 파라미터가 누락되었습니다." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!PORTONE_API_SECRET) {
      return new Response(JSON.stringify({ error: "PORTONE_API_SECRET이 설정되지 않았습니다." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chargeRes = await fetch(`https://api.portone.io/v2/payments/${encodeURIComponent(paymentId)}/instant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `PortOne ${PORTONE_API_SECRET}`,
      },
      body: JSON.stringify({
        storeId: PORTONE_STORE_ID,
        billingKey,
        orderName,
        amount: { total: amount },
        currency: "KRW",
        customer: { id: userId },
      }),
    });

    const chargeData = await chargeRes.json();

    if (!chargeRes.ok) {
      const errMsg = chargeData.message || chargeData.error?.message || "결제 승인 실패";
      if (SUPABASE_URL && SERVICE_ROLE_KEY) {
        await fetch(`${SUPABASE_URL}/rest/v1/subscription_payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: userId,
            plan_id: planId,
            portone_payment_id: paymentId,
            amount,
            status: "failed",
            error_message: errMsg,
          }),
        });
      }
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, paymentId, status: chargeData.status ?? "paid" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "서버 오류" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
