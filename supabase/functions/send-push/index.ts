import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Send Web Push notifications to a user's registered devices.
 * Called internally when a new message is sent.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientUserId, title, body, url } = await req.json();

    if (!recipientUserId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get VAPID keys from system_settings
    const { data: pubKeySetting } = await supabaseAdmin
      .from("system_settings").select("value").eq("key", "vapid_public_key").single();
    const { data: privKeySetting } = await supabaseAdmin
      .from("system_settings").select("value").eq("key", "vapid_private_key").single();
    const { data: contactSetting } = await supabaseAdmin
      .from("system_settings").select("value").eq("key", "vapid_contact").single();

    if (!pubKeySetting?.value || !privKeySetting?.value) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPublicKey = JSON.parse(pubKeySetting.value as string);
    const vapidPrivateKey = JSON.parse(privKeySetting.value as string);
    const vapidContact = contactSetting?.value ? JSON.parse(contactSetting.value as string) : "mailto:admin@kojobot.com";

    // Get user's push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", recipientUserId);

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url || "/messages" });
    let sent = 0;
    const failed: string[] = [];

    for (const sub of subscriptions) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidContact
        );
        sent++;
      } catch (err) {
        console.error(`Push failed for ${sub.endpoint}:`, err);
        failed.push(sub.id);
        // Remove expired/invalid subscriptions
        if ((err as any)?.status === 410 || (err as any)?.status === 404) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent, failed: failed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Implements the Web Push protocol using Web Crypto API.
 * Sends an encrypted push message to the user's push endpoint.
 */
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidContact: string
) {
  // Import VAPID private key
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const publicKeyBytes = base64UrlDecode(vapidPublicKey);

  const vapidKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: vapidPrivateKey,
      x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
      y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Create VAPID JWT
  const audience = new URL(subscription.endpoint).origin;
  const vapidJwt = await createVapidJwt(vapidKey, audience, vapidContact);

  // Encrypt payload using Web Push encryption (RFC 8291)
  const encrypted = await encryptPayload(
    subscription.keys.p256dh,
    subscription.keys.auth,
    new TextEncoder().encode(payload)
  );

  // Send to push service
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
    },
    body: encrypted,
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Push service returned ${response.status}: ${text}`);
    (error as any).status = response.status;
    throw error;
  }
  await response.text(); // consume body
}

async function createVapidJwt(privateKey: CryptoKey, audience: string, subject: string): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 86400,
    sub: subject,
  })));

  const unsignedToken = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const rawSig = derToRaw(new Uint8Array(signature));
  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // ECDSA signatures from Web Crypto are in DER format
  // Convert to raw 64-byte r||s format
  const raw = new Uint8Array(64);

  // If the signature is already raw (64 bytes), return as-is
  if (der.length === 64) return der;

  let offset = 2; // skip SEQUENCE tag and length
  // Read r
  if (der[offset] !== 0x02) throw new Error("Invalid DER signature");
  offset++;
  let rLen = der[offset++];
  let rStart = offset;
  if (rLen === 33 && der[rStart] === 0) { rStart++; rLen--; }
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), 32 - Math.min(rLen, 32));
  offset = rStart + rLen;

  // Adjust for padding
  if (der[rStart - 1 - (rLen === 32 ? 0 : 1)] === 33) offset = rStart + 32;

  // Read s
  offset = 2 + 2 + der[3]; // skip to s
  if (der[offset] !== 0x02) throw new Error("Invalid DER signature");
  offset++;
  let sLen = der[offset++];
  let sStart = offset;
  if (sLen === 33 && der[sStart] === 0) { sStart++; sLen--; }
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), 64 - Math.min(sLen, 32));

  return raw;
}

/**
 * Encrypt payload using RFC 8291 (Web Push Message Encryption).
 */
async function encryptPayload(
  p256dhBase64: string,
  authBase64: string,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const clientPublicKey = base64UrlDecode(p256dhBase64);
  const clientAuth = base64UrlDecode(authBase64);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import client's public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeyPair.privateKey,
      256
    )
  );

  // HKDF to derive IKM
  const authInfo = new TextEncoder().encode("WebPush: info\x00");
  const authInfoFull = concat(authInfo, clientPublicKey, localPublicKeyRaw);

  const ikm = await hkdf(clientAuth, sharedSecret, authInfoFull, 32);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\x00");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\x00");

  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad plaintext (add delimiter byte 0x02 + no padding)
  const paddedPlaintext = concat(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, paddedPlaintext)
  );

  // Build aes128gcm header: salt(16) + rs(4) + keyIdLen(1) + keyId(65) + ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  return concat(header, encrypted);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8
  );
  return new Uint8Array(derived);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
