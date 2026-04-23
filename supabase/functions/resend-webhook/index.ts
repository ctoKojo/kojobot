// Resend webhook receiver — captures delivery events and updates email_send_log
// Public endpoint (verify_jwt = false) secured via signing-secret HMAC verification
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-signature, svix-timestamp, resend-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

interface ResendEventPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string; message?: string };
    [k: string]: unknown;
  };
}

/**
 * Verify Svix-style signature used by Resend webhooks.
 * Header format: "v1,<base64-signature> v1,<base64-signature>"
 * Signed payload: `${svix_id}.${svix_timestamp}.${rawBody}`
 */
async function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject very old payloads (replay protection: 5 min window)
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  // Resend secret is "whsec_<base64>" — strip prefix and decode
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(secretKey), (c) => c.charCodeAt(0));
  } catch {
    keyBytes = new TextEncoder().encode(secretKey);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedPayload),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature can contain space-separated versions: "v1,xxx v1,yyy"
  const parts = svixSignature.split(" ");
  for (const part of parts) {
    const [version, sig] = part.split(",");
    if (version === "v1" && sig === expected) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  // Verify signature when secret configured
  if (WEBHOOK_SECRET) {
    const valid = await verifySvixSignature(rawBody, req.headers, WEBHOOK_SECRET);
    if (!valid) {
      console.warn("[resend-webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature check");
  }

  let payload: ResendEventPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = payload.type;
  if (!eventType) {
    return new Response(JSON.stringify({ error: "Missing event type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = payload.data ?? {};
  const messageId = (data.email_id as string | undefined) ?? null;
  const recipientRaw = data.to;
  const recipient = Array.isArray(recipientRaw)
    ? recipientRaw[0]
    : (recipientRaw as string | undefined);

  if (!recipient) {
    return new Response(JSON.stringify({ error: "Missing recipient" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resend sometimes sends an `id` at the top level for the event itself
  const eventId =
    ((payload as Record<string, unknown>).id as string | undefined) ??
    req.headers.get("svix-id") ??
    null;

  const occurredAt = payload.created_at ?? new Date().toISOString();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Insert raw event (idempotent via resend_event_id unique index)
  const { error: insertError } = await supabase
    .from("email_delivery_events")
    .insert({
      message_id: messageId,
      recipient_email: recipient,
      event_type: eventType,
      occurred_at: occurredAt,
      raw_payload: payload as unknown as Record<string, unknown>,
      resend_event_id: eventId,
    });

  if (insertError && insertError.code !== "23505") {
    // 23505 = unique violation (duplicate event) — safe to ignore
    console.error("[resend-webhook] Insert error:", insertError);
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Update latest delivery status on email_send_log (best-effort)
  // IMPORTANT: email_send_log.message_id stores our internal idempotencyKey,
  // NOT the Resend email id. The Resend id is stored inside metadata.resend_id.
  // So we look up the row by metadata->>'resend_id' = messageId.
  if (messageId) {
    const statusMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "deferred",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.failed": "failed",
    };
    const deliveryStatus = statusMap[eventType] ?? eventType;
    const bounce = data.bounce ?? {};

    const updates: Record<string, unknown> = {
      delivery_status: deliveryStatus,
      delivery_status_at: occurredAt,
    };
    if (eventType === "email.bounced") {
      updates.bounce_type = (bounce.type as string | undefined) ?? null;
      updates.bounce_reason =
        (bounce.message as string | undefined) ??
        (bounce.subType as string | undefined) ??
        null;
    }

    // Find the matching row by Resend's email_id (stored in metadata.resend_id)
    const { data: matchRows, error: matchError } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("metadata->>resend_id", messageId)
      .limit(5);

    if (matchError) {
      console.warn("[resend-webhook] Match query warning:", matchError.message);
    }

    if (matchRows && matchRows.length > 0) {
      const ids = matchRows.map((r: { id: string }) => r.id);
      const { error: updateError } = await supabase
        .from("email_send_log")
        .update(updates)
        .in("id", ids);
      if (updateError) {
        console.warn("[resend-webhook] Update send_log warning:", updateError.message);
      }
    } else {
      // Fallback: try the legacy path in case message_id was stored directly
      const { error: legacyError } = await supabase
        .from("email_send_log")
        .update(updates)
        .eq("message_id", messageId);
      if (legacyError) {
        console.warn(
          "[resend-webhook] Legacy update warning (no row matched resend_id):",
          legacyError.message,
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, event: eventType }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
