
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let createdUserId: string | null = null;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      return json({ error: "Server configuration is missing." }, 500);
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Sign in is required." }, 401);
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
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
      console.error("Role lookup:", roleError.message);
      return json({ error: "Could not verify admin permissions." }, 500);
    }

    if (roleRow?.role !== "admin") {
      return json({ error: "Admin access is required." }, 403);
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

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const designation =
      typeof body.designation === "string" ? body.designation.trim() : "";
    const unitId =
      typeof body.unitId === "string" ? body.unitId.trim() : "";

    if (fullName.length < 2) {
      return json({ error: "Enter a name with at least 2 characters." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    if (!designation) {
      return json({ error: "Designation is required." }, 400);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitId)) {
      return json({ error: "Select a valid organisational unit." }, 400);
    }

    const { data: unit, error: unitError } = await admin
      .from("units")
      .select("id, name")
      .eq("id", unitId)
      .eq("is_active", true)
      .maybeSingle();

    if (unitError || !unit) {
      return json({ error: "The selected unit does not exist or is inactive." }, 400);
    }

    const tempPassword = `Ap!${crypto.randomUUID()}9x`;

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, designation },
      });

    if (authError || !authData.user) {
      return json(
        { error: authError?.message ?? "Could not create login account." },
        400,
      );
    }

    createdUserId = authData.user.id;

    const personnelCode =
      `AP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const { error: profileError } = await admin
      .from("profiles")
      .insert({
        id: createdUserId,
        personnel_code: personnelCode,
        full_name: fullName,
        email,
        designation,
        unit_id: unit.id,
        is_active: true,
      });

    if (profileError) {
      console.error("Profile creation:", profileError.message);
      throw new Error(`Could not create personnel profile: ${profileError.message}`);
    }

    const { error: roleInsertError } = await admin
      .from("user_roles")
      .insert({
        user_id: createdUserId,
        role: "personnel",
      });

    if (roleInsertError) {
      console.error("Role creation:", roleInsertError.message);
      throw new Error(`Could not assign personnel role: ${roleInsertError.message}`);
    }

    const { error: auditError } = await admin
      .from("audit_logs")
      .insert({
        actor_id: callerData.user.id,
        action: "personnel.created",
        target_table: "profiles",
        target_record_id: createdUserId,
        reason: "Created by administrator",
        metadata: {
          personnel_code: personnelCode,
          email,
          unit_name: unit.name,
        },
      });

    if (auditError) {
      console.error("Audit log:", auditError.message);
    }

    return json({
      message: "Personnel account created successfully.",
      profile: {
        id: createdUserId,
        personnel_code: personnelCode,
        full_name: fullName,
        email,
        designation,
        unit_id: unit.id,
        unit_label: unit.name,
        is_active: true,
      },
      tempPassword,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    console.error("admin-create-personnel:", message);

    if (createdUserId) {
      const url = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (url && serviceKey) {
        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        await admin.from("profiles").delete().eq("id", createdUserId);
        await admin.from("user_roles").delete().eq("user_id", createdUserId);
        await admin.auth.admin.deleteUser(createdUserId);
      }
    }

    return json({ error: message }, 400);
  }
});
