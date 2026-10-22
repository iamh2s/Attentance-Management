
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !resendKey ||
      !fromEmail
    ) {
      return jsonResponse(
        { error: "Email service is not configured." },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } =
      await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid session." }, 401);
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } },
    );

    const { data: role, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (roleError || role?.role !== "admin") {
      return jsonResponse(
        { error: "Administrator access required." },
        403,
      );
    }

    const body = await req.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !fullName ||
      password.length < 8 ||
      password.length > 128
    ) {
      return jsonResponse(
        { error: "Invalid email or credential details." },
        400,
      );
    }

    const { data: profile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", email)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.email?.toLowerCase() !== email
    ) {
      return jsonResponse(
        { error: "No matching APAMS personnel profile was found." },
        404,
      );
    }

    const emailResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Your APAMS login details",
          text: [
            `Hello ${fullName},`,
            "",
            "Your APAMS personnel account is ready.",
            `Login email: ${email}`,
            `Initial password: ${password}`,
            "",
            "Please sign in and change your password as soon as possible.",
          ].join("\n"),
        }),
      },
    );

    if (!emailResponse.ok) {
      return jsonResponse(
        { error: "Email provider rejected the message. Please try again." },
        502,
      );
    }

    // Never log or store the password or email body.
    return jsonResponse({ success: true });
  } catch {
    return jsonResponse(
      { error: "Unable to send the email." },
      500,
    );
  }
});
