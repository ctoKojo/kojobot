import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYMOB_BASE = "https://accept.paymob.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request_id, payment_method } = await req.json();

    if (!request_id || !payment_method) {
      return new Response(
        JSON.stringify({ error: "request_id and payment_method are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["card", "wallet", "fawry"].includes(payment_method)) {
      return new Response(
        JSON.stringify({ error: "Invalid payment_method. Must be card, wallet, or fawry" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get subscription request with plan details
    const { data: request, error: reqErr } = await supabase
      .from("subscription_requests")
      .select("*, landing_plans!inner(name_en, name_ar, price_number, price_online, slug)")
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      return new Response(
        JSON.stringify({ error: "Subscription request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (request.payment_status === "paid") {
      return new Response(
        JSON.stringify({ error: "This request is already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan = request.landing_plans as any;
    // Use online price for online attendance, otherwise regular price
    const priceEGP = request.attendance_mode === "online" ? plan.price_online : plan.price_number;
    const amountCents = Math.round(priceEGP * 100);

    // Determine integration ID based on payment method
    const integrationMap: Record<string, string> = {
      card: Deno.env.get("PAYMOB_INTEGRATION_ID_VPC")!,
      wallet: Deno.env.get("PAYMOB_INTEGRATION_ID_UIG")!,
      fawry: Deno.env.get("PAYMOB_INTEGRATION_ID_CASH")!,
    };

    const integrationId = parseInt(integrationMap[payment_method]);
    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "Payment method integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secretKey = Deno.env.get("Secret_key_paymob")!;
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paymob-webhook`;

    // Parse name into first/last
    const nameParts = request.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "N/A";
    const lastName = nameParts.slice(1).join(" ") || "N/A";

    // Create Paymob Intention
    const intentionRes = await fetch(`${PAYMOB_BASE}/v1/intention/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${secretKey}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: "EGP",
        payment_methods: [integrationId],
        items: [
          {
            name: plan.name_en || "Subscription",
            amount: amountCents,
            description: `Subscription: ${plan.name_en}`,
            quantity: 1,
          },
        ],
        billing_data: {
          first_name: firstName,
          last_name: lastName,
          email: request.email,
          phone_number: request.phone,
          apartment: "N/A",
          floor: "N/A",
          street: "N/A",
          building: "N/A",
          shipping_method: "N/A",
          postal_code: "N/A",
          city: "Cairo",
          country: "EG",
          state: "Cairo",
        },
        special_reference: request_id,
        redirection_url: `${req.headers.get("origin") || "https://kojobot.lovable.app"}/payment-callback`,
        notification_url: callbackUrl,
      }),
    });

    if (!intentionRes.ok) {
      const errText = await intentionRes.text();
      console.error("Paymob intention error:", intentionRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to create payment session" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intention = await intentionRes.json();
    const clientSecret = intention.client_secret;

    if (!clientSecret) {
      console.error("No client_secret in response:", JSON.stringify(intention));
      return new Response(
        JSON.stringify({ error: "Invalid payment gateway response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update subscription_requests with payment tracking
    await supabase
      .from("subscription_requests")
      .update({
        paymob_order_id: intention.id?.toString() || clientSecret,
        payment_status: "pending",
        payment_method,
        amount_cents: amountCents,
      })
      .eq("id", request_id);

    // Build checkout URL
    const publicKey = Deno.env.get("Public_key_paymob")!;
    const checkoutUrl = `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`;

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        client_secret: clientSecret,
        amount_cents: amountCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
