/**
 * Simple in-memory rate limiting utility for Edge Functions
 * Note: This is per-instance rate limiting. For production at scale,
 * consider using Redis or a distributed rate limiting solution.
 */

// Store request timestamps per IP
const rateLimitStore = new Map<string, number[]>();

interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed
  windowMs: number;     // Time window in milliseconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterSeconds?: number;
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get existing timestamps for this identifier
  const timestamps = rateLimitStore.get(identifier) || [];

  // Filter out timestamps outside the current window
  const validTimestamps = timestamps.filter(ts => ts > windowStart);

  // Check if rate limit exceeded
  if (validTimestamps.length >= config.maxRequests) {
    const oldestTimestamp = validTimestamps[0];
    const resetTime = oldestTimestamp + config.windowMs;
    const retryAfterSeconds = Math.ceil((resetTime - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfterSeconds,
    };
  }

  // Add current timestamp and update store
  validTimestamps.push(now);
  rateLimitStore.set(identifier, validTimestamps);

  // Cleanup old entries periodically (every ~100 requests)
  if (Math.random() < 0.01) {
    cleanupOldEntries(config.windowMs);
  }

  return {
    allowed: true,
    remaining: config.maxRequests - validTimestamps.length,
    resetTime: now + config.windowMs,
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a default identifier
  return 'unknown';
}

/**
 * Create a rate limit response with appropriate headers
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds || 60),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetTime),
      },
    }
  );
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
  maxRequests: number
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(maxRequests));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetTime));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Cleanup old entries to prevent memory bloat
 */
function cleanupOldEntries(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;

  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(ts => ts > cutoff);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, validTimestamps);
    }
  }
}

/**
 * Higher-order function to wrap a handler with rate limiting
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 },
  corsHeaders: Record<string, string> = {}
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const clientIP = getClientIP(req);
    const result = checkRateLimit(clientIP, config);

    if (!result.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return rateLimitResponse(result, corsHeaders);
    }

    const response = await handler(req);
    return addRateLimitHeaders(response, result, config.maxRequests);
  };
}
