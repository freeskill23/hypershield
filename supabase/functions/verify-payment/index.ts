import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PORTONE_API_SECRET = Deno.env.get("PORTONE_API_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { paymentId, orderId } = await req.json();
    if (!paymentId || !orderId) {
      return new Response(
        JSON.stringify({ ok: false, error: "paymentId와 orderId가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!PORTONE_API_SECRET) {
      return new Response(
        JSON.stringify({ ok: false, error: "PortOne API secret이 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let isPaid = false;
    let lastError = "";
    for (let attempt = 0; attempt < 5 && !isPaid; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(3000 * attempt, 12000)));
      try {
        const verifyRes = await fetch(
          `https://api.portone.io/v2/payments/${encodeURIComponent(paymentId)}`,
          { method: "GET", headers: { "Authorization": `PortOne ${PORTONE_API_SECRET}` } },
        );
        if (verifyRes.ok) {
          const payment = await verifyRes.json();
          if (payment?.status === "PAID") {
            isPaid = true;
            break;
          }
        } else {
          lastError = `PortOne returned ${verifyRes.status}`;
        }
      } catch (e) {
        lastError = `PortOne API error: ${e.message}`;
      }
    }

    if (!isPaid) {
      return new Response(
        JSON.stringify({ ok: false, error: `결제가 완료되지 않았습니다. ${lastError}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      const adminHeaders = {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      };
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ status: "paid" }),
        },
      );
      if (!res.ok) {
        console.error("verify-payment: failed to update order", res.status, await res.text());
      }
    }

    return new Response(
      JSON.stringify({ ok: true, paid: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-payment error", e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
