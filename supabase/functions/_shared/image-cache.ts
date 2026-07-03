// _shared/image-cache.ts
//
// Cheapest possible rate-limit relief: never call a vision model twice for
// the same image. This matters more than it sounds — youtube-sync will
// frequently re-encounter thumbnails that were already analyzed manually,
// and users re-test the same upload while iterating on recommendations.

export async function hashImageUrl(imageUrl: string): Promise<string> {
  // Hashing the URL is enough for Supabase Storage-hosted files, since a
  // given uploaded file always resolves to the same storage path. If you
  // later allow re-uploads of visually-identical files under new paths,
  // switch to hashImageBytes() instead (fetch the image, hash the bytes).
  const enc = new TextEncoder().encode(imageUrl);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return toHex(digest);
}

export async function hashImageBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}