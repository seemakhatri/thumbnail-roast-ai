// _shared/google-oauth.ts
//
// SECURITY FIX for youtube-sync: the old flow accepted a raw `accessToken`
// straight from the client body and forwarded it to the YouTube API with
// no verification it belonged to the authenticated user or was even valid.
// That's spoofable by anyone holding a valid Supabase JWT.
//
// Correct flow:
//   1. During OAuth connect (one-time), exchange the Google `code` for a
//      refresh_token and store it server-side in `youtube_connections`
//      (service-role only table, no client access — see migration).
//   2. On every sync, mint a fresh short-lived access token here using the
//      stored refresh token. The client never handles a YouTube access
//      token at all.

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string; // only present on the very first exchange
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    // A 400 here usually means the refresh token was revoked — the caller
    // should prompt the user to reconnect their YouTube account.
    throw new Error(`Google token refresh failed: ${await res.text()}`);
  }
  return res.json();
}