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
    for (let attempt = 0; attempt < 8 && !isPaid; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(2000 * (attempt + 1), 15000)));
      try {
        const verifyRes = await fetch(
          `https://api.portone.io/v2/payments/${encodeURIComponent(paymentId)}`,
          { method: "GET", headers: { "Authorization": `PortOne ${PORTONE_API_SECRET}` } },
        );
        if (verifyRes.ok) {
          const payment = await verifyRes.json();
          const status = payment?.status;
          if (status === "PAID") {
            isPaid = true;
            break;
          }
          if (status === "READY" || status === "IN_PROGRESS" || status === "REQUESTED") {
            lastError = `결제 진행 중 (status: ${status})`;
            continue;
          }
          if (status === "FAILED" || status === "CANCELLED" || status === "REFUNDED") {
            lastError = `결제 실패 (status: ${status})`;
            break;
          }
          lastError = `알 수 없는 결제 상태: ${status}`;
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

      // Primary: update by order id
      let updated = false;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: { ...adminHeaders, "Prefer": "return=representation" },
          body: JSON.stringify({ status: "paid" }),
        },
      );
      if (res.ok) {
        const updatedRows = await res.json().catch(() => []);
        updated = Array.isArray(updatedRows) && updatedRows.length > 0;
      } else {
        console.error("verify-payment: failed to update order by id", res.status, await res.text());
      }

      // Fallback: update by portone_payment_id (webhook may have used this)
      if (!updated) {
        const res2 = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?portone_payment_id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`,
          {
            method: "PATCH",
            headers: { ...adminHeaders, "Prefer": "return=representation" },
            body: JSON.stringify({ status: "paid" }),
          },
        );
        if (res2.ok) {
          const updatedRows2 = await res2.json().catch(() => []);
          updated = Array.isArray(updatedRows2) && updatedRows2.length > 0;
        } else {
          console.error("verify-payment: failed to update order by payment_id", res2.status, await res2.text());
        }
      }

      // If still not updated, check if it's already paid (webhook beat us)
      if (!updated) {
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=status`,
          { headers: adminHeaders },
        );
        if (checkRes.ok) {
          const checkRows = await checkRes.json().catch(() => []);
          if (Array.isArray(checkRows) && checkRows[0]?.status === "paid") {
            updated = true;
          }
        }
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
