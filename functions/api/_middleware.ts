// Rate-limiting middleware for all /api/* routes
// Uses a simple in-memory counter (resets per isolate lifecycle)

interface Env {
  RATE_LIMIT_PER_MINUTE: string;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const ip = getClientIP(context.request);
  const limit = parseInt(context.env.RATE_LIMIT_PER_MINUTE || '20', 10);
  const now = Date.now();

  // Clean up expired entries periodically
  if (Math.random() < 0.1) {
    for (const [key, val] of rateLimitMap) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  // Check rate limit
  let entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + 60_000 };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;

  if (entry.count > limit) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Maximum ${limit} requests per minute. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((entry.resetAt - now) / 1000).toString(),
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // CORS headers for all API responses
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  newResponse.headers.set('X-RateLimit-Limit', limit.toString());
  newResponse.headers.set('X-RateLimit-Remaining', Math.max(0, limit - entry.count).toString());

  return newResponse;
};
