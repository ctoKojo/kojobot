import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function computeHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle
    .importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, encoder.encode(data)))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Paymob sends transaction callbacks as POST with JSON body
    // and also as GET with query params for redirection
    const url = new URL(req.url);
    let txnData: Record<string, any>;

    if (req.method === "POST") {
      const body = await req.json();
      txnData = body.obj || body;
    } else if (req.method === "GET") {
      // Query string callback
      txnData = Object.fromEntries(url.searchParams.entries());
    } else {
      return new Response("Method not allowed", { status: 405 });
    }

    // Extract key fields
    const hmacReceived = txnData.hmac || url.searchParams.get("hmac") || "";
    const success = txnData.success === true || txnData.success === "true";
    const orderId = txnData.order?.id?.toString() || txnData.order_id || txnData.id?.toString() || "";
    const transactionId = txnData.id?.toString() || "";
    const amountCents = parseInt(txnData.amount_cents || "0");
    const specialReference = txnData.order?.merchant?.company_name || 
                             txnData.special_reference || 
                             txnData.merchant_order_id || "";

    // HMAC Verification
    const hmacSecret = Deno.env.get("HMAC_paymob")!;

    if (hmacSecret && hmacReceived) {
      // Paymob HMAC concatenation order (sorted alphabetically)
      const hmacFields = [
        txnData.amount_cents?.toString() || "",
        txnData.created_at || "",
        txnData.currency || "EGP",
        txnData.error_occured?.toString() || "false",
        txnData.has_parent_transaction?.toString() || "false",
        txnData.id?.toString() || "",
        txnData.integration_id?.toString() || "",
        txnData.is_3d_secure?.toString() || "false",
        txnData.is_auth?.toString() || "false",
        txnData.is_capture?.toString() || "false",
        txnData.is_refunded?.toString() || "false",
        txnData.is_standalone_payment?.toString() || "true",
        txnData.is_voided?.toString() || "false",
        txnData.order?.id?.toString() || txnData.order_id || "",
        txnData.owner?.toString() || "",
        txnData.pending?.toString() || "false",
        txnData.source_data?.pan || "",
        txnData.source_data?.sub_type || "",
        txnData.source_data?.type || "",
        txnData.success?.toString() || "false",
      ].join("");

      const expectedHMAC = await computeHMAC(hmacFields, hmacSecret);

      if (expectedHMAC !== hmacReceived) {
        console.error("HMAC mismatch! Expected:", expectedHMAC, "Received:", hmacReceived);
        return new Response(
          JSON.stringify({ error: "Invalid HMAC signature" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update subscription request
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to find by special_reference (which is request_id) or by paymob_order_id
    let matchField = "paymob_order_id";
    let matchValue = orderId;

    if (specialReference && specialReference.length === 36) {
      // UUID format - likely our request_id
      matchField = "id";
      matchValue = specialReference;
    }

    if (matchValue) {
      const updateData: Record<string, any> = {
        payment_status: success ? "paid" : "failed",
      };

      if (success) {
        updateData.paid_at = new Date().toISOString();
        updateData.status = "contacted"; // Auto-update status when paid
      }

      const { error: updateErr } = await supabase
        .from("subscription_requests")
        .update(updateData)
        .eq(matchField, matchValue);

      if (updateErr) {
        console.error("DB update error:", updateErr);
      } else {
        console.log(`Payment ${success ? "SUCCESS" : "FAILED"} for ${matchField}=${matchValue}`);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
