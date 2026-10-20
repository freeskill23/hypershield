import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, admin_id } = await req.json();

    if (!user_id || !admin_id) {
      return new Response(
        JSON.stringify({ error: "user_id, admin_id가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (user_id === admin_id) {
      return new Response(
        JSON.stringify({ error: "자기 자신은 삭제할 수 없습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin
    const adminResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${admin_id}&select=role`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    const adminData = await adminResp.json();
    if (!adminData || adminData.length === 0 || adminData[0].role !== "admin") {
      return new Response(
        JSON.stringify({ error: "관리자 권한이 필요합니다." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prevent deleting other admins
    const targetResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user_id}&select=role`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    const targetData = await targetResp.json();
    if (targetData && targetData.length > 0 && targetData[0].role === "admin") {
      return new Response(
        JSON.stringify({ error: "관리자 계정은 삭제할 수 없습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete the auth user — ON DELETE CASCADE cleans up profiles and related rows
    const deleteResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${user_id}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!deleteResp.ok) {
      const errBody = await deleteResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: errBody.msg || errBody.message || `회원 삭제 실패 (${deleteResp.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "회원 삭제에 실패했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
