
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      return json({ error: "Server configuration is missing." }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Sign in is required." }, 401);
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } =
      await caller.auth.getUser();

    if (callerError || !callerData.user) {
      return json({ error: "Invalid login session." }, 401);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roleRow, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Role lookup failed:", roleError.message);
      return json({ error: "Could not verify admin permissions." }, 500);
    }

    if (roleRow?.role !== "admin") {
      return json({ error: "Administrator access is required." }, 403);
    }

    let body: Record<string, unknown>;

    try {
      const parsed = await req.json();

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: "Invalid request body." }, 400);
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }

    const personnelId =
      typeof body.personnelId === "string" ? body.personnelId.trim() : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(personnelId)
    ) {
      return json({ error: "A valid personnel UUID is required." }, 400);
    }

    if (personnelId === callerData.user.id) {
      return json({ error: "You cannot deactivate your own account." }, 400);
    }

    const { data: target, error: findError } = await admin
      .from("profiles")
      .select("id, full_name, personnel_code, is_active")
      .eq("id", personnelId)
      .maybeSingle();

    if (findError) {
      console.error("Profile lookup failed:", findError.message);
      return json({ error: "Could not find the personnel record." }, 500);
    }

    if (!target) {
      return json({ error: "Personnel record not found." }, 404);
    }

    // Prevent deactivation of another administrator through this endpoint.
    const { data: targetRole, error: targetRoleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", personnelId)
      .maybeSingle();

    if (targetRoleError) {
      return json({ error: "Could not verify the target user's role." }, 500);
    }

    if (targetRole?.role === "admin") {
      return json(
        { error: "Admin accounts cannot be deactivated through this function." },
        400,
      );
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personnelId);

    if (profileError) {
      console.error("Profile deactivation failed:", profileError.message);
      return json({ error: "Could not deactivate personnel." }, 500);
    }

    // Ban login for 100 years; this can be reversed by an admin later.
    const { error: authError } = await admin.auth.admin.updateUserById(
      personnelId,
      { ban_duration: "876000h" },
    );

    if (authError) {
      console.error("Auth ban failed:", authError.message);

      // Restore the previous active state if login disabling fails.
      await admin
        .from("profiles")
        .update({
          is_active: target.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", personnelId);

      return json({ error: "Could not disable the login account." }, 500);
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: callerData.user.id,
      action: "personnel.deactivated",
      target_table: "profiles",
      target_record_id: personnelId,
      reason: "Deactivated by administrator",
      metadata: {
        personnel_code: target.personnel_code,
        full_name: target.full_name,
      },
    });

    if (auditError) {
      console.error("Audit log insert failed:", auditError.message);
    }

    return json({
      message: "Personnel deactivated and login disabled.",
      personnelId,
      is_active: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    console.error("admin-delete-personnel failed:", message);
    return json({ error: message }, 500);
  }
});
