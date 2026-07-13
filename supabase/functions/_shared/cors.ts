const allowedOrigins = [
  "https://thumbnail-roast.com",
  "https://www.thumbnail-roast.com",
  "http://localhost:4200",
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && allowedOrigins.includes(origin);
  const allowOrigin = isAllowed ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-correlation-id",
    "Access-Control-Expose-Headers":
      "x-correlation-id, x-rate-limit-remaining, x-rate-limit-reset",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    const headers = getCorsHeaders(origin);
    if (origin) {
      const isAllowed = allowedOrigins.includes(origin);
      console.log(
        `CORS preflight from ${origin} - ${isAllowed ? "ALLOWED" : "REJECTED"}`,
      );
    }

    return new Response(null, {
      status: 204,
      headers,
    });
  }
  return null;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  req?: Request,
): Response {
  const origin = req?.headers.get("origin") || null;
  const headers = getCorsHeaders(origin);

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}

export function errorResponse(
  message: string,
  status = 500,
  req?: Request,
): Response {
  // Sanitize error message for production
  const isProduction = Deno.env.get("ENV") === "production";
  const errorMessage =
    isProduction && status >= 500 ? "An internal error occurred" : message;

  return jsonResponse({ error: errorMessage }, status, req);
}
