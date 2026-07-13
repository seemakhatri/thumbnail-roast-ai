// _shared/security-headers.ts
export interface SecurityHeaders {
  "X-Content-Type-Options": "nosniff";
  "X-Frame-Options": "DENY";
  "X-XSS-Protection": "1; mode=block";
  "Strict-Transport-Security": string;
  "Content-Security-Policy": string;
  "Referrer-Policy": "strict-origin-when-cross-origin";
  "Permissions-Policy": string;
}

export function getSecurityHeaders(): SecurityHeaders {
  const isProduction = Deno.env.get("ENV") === "production";
  
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": isProduction
      ? "max-age=31536000; includeSubDomains; preload"
      : "max-age=0",
    "Content-Security-Policy": isProduction
      ? "default-src 'self'; connect-src 'self' https://api.stripe.com https://*.supabase.co; script-src 'self' 'unsafe-inline' https://*.stripe.com; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline'; frame-src https://*.stripe.com"
      : "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
  };
}

export function applySecurityHeaders(response: Response): Response {
  const headers = getSecurityHeaders();
  const newHeaders = new Headers(response.headers);
  
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}