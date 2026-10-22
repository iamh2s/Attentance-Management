import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Answer the browser's preflight check.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Not signed in (no token sent)." }, 401);
  }

  // Verify the caller's session token.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json(
      { error: `Not signed in: ${userError?.message ?? "no user"}` },
      401,
    );
  }

  // Check the admin role with the service key, so RLS cannot hide it.
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: roleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (roleError) {
    return json({ error: `Role lookup failed: ${roleError.message}` }, 500);
  }

  if (roleRow?.role !== "admin") {
    return json({ error: "Administrator access is required." }, 403);
  }

  let body: { userId?: unknown; newPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  const { userId, newPassword } = body;

  if (typeof userId !== "string" || typeof newPassword !== "string") {
    return json({ error: "userId and newPassword are required." }, 400);
  }
  if (newPassword.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, 400);
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ success: true });
});