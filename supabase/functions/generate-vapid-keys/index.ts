import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate VAPID key pair and store in system_settings.
 * Only admins can call this. Idempotent - returns existing keys if already generated.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claims.claims.sub;

    // Check admin role
    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if keys already exist
    const { data: existing } = await supabaseAdmin.from("system_settings").select("value").eq("key", "vapid_public_key").single();
    if (existing?.value) {
      const { data: privExisting } = await supabaseAdmin.from("system_settings").select("value").eq("key", "vapid_private_key").single();
      return new Response(JSON.stringify({
        public_key: existing.value,
        private_key_stored: !!privExisting?.value,
        message: "VAPID keys already exist",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    // Export keys
    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // Convert public key to URL-safe base64
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // Convert private key (d parameter) to URL-safe base64
    const privateKeyBase64 = privateKeyJwk.d!;

    // Store both keys in system_settings
    await supabaseAdmin.from("system_settings").upsert(
      { key: "vapid_public_key", value: JSON.stringify(publicKeyBase64), updated_by: userId },
      { onConflict: "key" }
    );

    await supabaseAdmin.from("system_settings").upsert(
      { key: "vapid_private_key", value: JSON.stringify(privateKeyBase64), updated_by: userId },
      { onConflict: "key" }
    );

    // Also store contact email for VAPID
    await supabaseAdmin.from("system_settings").upsert(
      { key: "vapid_contact", value: JSON.stringify("mailto:admin@kojobot.com"), updated_by: userId },
      { onConflict: "key" }
    );

    return new Response(JSON.stringify({
      public_key: publicKeyBase64,
      message: "VAPID keys generated and stored successfully",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Error generating VAPID keys:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
