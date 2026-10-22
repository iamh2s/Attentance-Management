
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

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(value);

const isDate = (value: unknown): value is string => {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
};

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

    const personnelId = body.personnelId;
    const attendanceDate = body.attendanceDate;
    const status = body.status;

    if (!isUuid(personnelId)) {
      return json({ error: "A valid personnel UUID is required." }, 400);
    }

    if (!isDate(attendanceDate)) {
      return json({ error: "Use attendanceDate in YYYY-MM-DD format." }, 400);
    }

    if (!["present", "absent", "approved_leave"].includes(String(status))) {
      return json({
        error: "Status must be present, absent, or approved_leave.",
      }, 400);
    }

    const reason =
      typeof body.correctionReason === "string"
        ? body.correctionReason.trim()
        : "";

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("id", personnelId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return json({ error: "Could not look up personnel." }, 500);
    }

    if (!profile) {
      return json({ error: "Personnel record not found." }, 404);
    }

    if (!profile.is_active) {
      return json({ error: "Inactive personnel cannot be marked." }, 400);
    }

    const { data: existing, error: existingError } = await admin
      .from("attendance")
      .select("id, status")
      .eq("personnel_id", personnelId)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (existingError) {
      console.error("Attendance lookup failed:", existingError.message);
      return json({ error: "Could not check existing attendance." }, 500);
    }

    const now = new Date().toISOString();

    const attendanceRow = {
      personnel_id: personnelId,
      attendance_date: attendanceDate,
      status,
      marked_by: callerData.user.id,
      updated_by: callerData.user.id,
      correction_reason: existing ? (reason || null) : null,
      updated_at: now,
    };

    const { data: saved, error: saveError } = await admin
      .from("attendance")
      .upsert(attendanceRow, {
        onConflict: "personnel_id,attendance_date",
      })
      .select("*")
      .single();

    if (saveError || !saved) {
      console.error("Attendance save failed:", saveError?.message);
      return json({
        error: saveError?.message ?? "Could not save attendance.",
      }, 500);
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: callerData.user.id,
      action: existing ? "attendance.updated" : "attendance.created",
      target_table: "attendance",
      target_record_id: saved.id,
      reason: reason || "Attendance saved by administrator",
      metadata: {
        personnel_id: personnelId,
        attendance_date: attendanceDate,
        previous_status: existing?.status ?? null,
        new_status: status,
      },
    });

    if (auditError) {
      console.error("Attendance audit logging failed:", auditError.message);
    }

    return json({
      message: "Attendance saved successfully.",
      attendance: saved,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    console.error("admin-set-attendance failed:", message);
    return json({ error: message }, 500);
  }
});
