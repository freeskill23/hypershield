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
    const webhook = (await req.json()) as {
      type?: string;
      data?: { paymentId?: string; billingKey?: string; status?: string };
    };

    if (!webhook.data?.paymentId || !PORTONE_API_SECRET) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = webhook.data.paymentId;

    const verifyRes = await fetch(`https://api.portone.io/v2/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { "Authorization": `PortOne ${PORTONE_API_SECRET}` },
    });
    const payment = await verifyRes.json();

    if (payment.status === "PAID" && SUPABASE_URL && SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/orders?portone_payment_id=eq.${encodeURIComponent(paymentId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ status: "paid" }),
      });
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
