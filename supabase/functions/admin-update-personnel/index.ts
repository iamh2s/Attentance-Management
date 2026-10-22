
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

    const updates: Record<string, unknown> = {};

    if (body.fullName !== undefined) {
      if (typeof body.fullName !== "string" || body.fullName.trim().length < 2) {
        return json({ error: "Name must contain at least 2 characters." }, 400);
      }
      updates.full_name = body.fullName.trim();
    }

    if (body.email !== undefined) {
      if (typeof body.email !== "string") {
        return json({ error: "A valid email address is required." }, 400);
      }

      const email = body.email.trim().toLowerCase();
      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return json({ error: "A valid email address is required." }, 400);
      }

      updates.email = email;
    }

    if (body.designation !== undefined) {
      if (typeof body.designation !== "string" || !body.designation.trim()) {
        return json({ error: "Designation is required." }, 400);
      }
      updates.designation = body.designation.trim();
    }

    if (body.unitId !== undefined) {
      if (
        typeof body.unitId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(body.unitId)
      ) {
        return json({ error: "Select a valid unit." }, 400);
      }

      const { data: unit, error: unitError } = await admin
        .from("units")
        .select("id")
        .eq("id", body.unitId)
        .eq("is_active", true)
        .maybeSingle();

      if (unitError || !unit) {
        return json({ error: "The selected unit is not available." }, 400);
      }

      updates.unit_id = unit.id;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return json({ error: "isActive must be true or false." }, 400);
      }
      updates.is_active = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid changes were provided." }, 400);
    }

    const { data: existing, error: findError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", personnelId)
      .maybeSingle();

    if (findError) {
      console.error("Profile lookup failed:", findError.message);
      return json({ error: "Could not find the personnel record." }, 500);
    }

    if (!existing) {
      return json({ error: "Personnel record not found." }, 404);
    }

    // Keep the Auth email aligned with the profile email.
    if (updates.email !== undefined) {
      const { error: authError } = await admin.auth.admin.updateUserById(
        personnelId,
        { email: String(updates.email), email_confirm: true },
      );

      if (authError) {
        return json({ error: `Could not update login email: ${authError.message}` }, 400);
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", personnelId)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("Profile update failed:", updateError?.message);
      return json(
        { error: updateError?.message ?? "Could not update personnel." },
        400,
      );
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: callerData.user.id,
      action: "personnel.updated",
      target_table: "profiles",
      target_record_id: personnelId,
      reason: "Personnel updated by administrator",
      metadata: { changed_fields: Object.keys(updates) },
    });

    if (auditError) {
      console.error("Audit logging failed:", auditError.message);
    }

    return json({
      message: "Personnel updated successfully.",
      profile: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    console.error("admin-update-personnel failed:", message);
    return json({ error: message }, 500);
  }
});
