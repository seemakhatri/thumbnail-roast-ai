// _shared/image-prep.ts
//
// Fetches a (Supabase Storage) image URL and returns base64-encoded bytes
// ready to inline into a provider request. Extracted unchanged from the
// old gemini.ts's buildBase64()/preprocessImageBuffer() so ai-analyzer.ts,
// vision-analyzer.ts, and vision-comparator.ts all share one implementation
// instead of three near-identical copies.
//
// Images are always sent as inline base64 data (never as a bare remote
// URL) because not every model reachable through OpenRouter reliably
// fetches arbitrary remote URLs — inlining the bytes works the same way
// regardless of which model OPENROUTER_MODEL points at.

export interface PreparedImage {
  base64: string;
  mimeType: string;
}

// ── IMAGE PREPROCESSING (unchanged from gemini.ts) ────────────────────────
async function preprocessImageBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  try {
    const blob = new Blob([arrayBuffer]);
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width <= 640)
      return { buffer: arrayBuffer, mimeType: "image/jpeg" };

    const targetWidth = 640;
    const targetHeight = Math.round(
      (bitmap.height / bitmap.width) * targetWidth,
    );
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outputBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.85,
    });
    const resizedBuffer = await outputBlob.arrayBuffer();
    console.log(
      `Image resized: ${bitmap.width}×${bitmap.height} → ${targetWidth}×${targetHeight}`,
    );
    return { buffer: resizedBuffer, mimeType: "image/jpeg" };
  } catch (e) {
    console.warn("Image preprocessing skipped:", e);
    return { buffer: arrayBuffer, mimeType: "image/jpeg" };
  }
}

/** Fetches imageUrl, downsizes it if wider than 640px, and returns
 *  base64-encoded bytes + mime type. */
export async function fetchImageAsBase64(imageUrl: string): Promise<PreparedImage> {
  const raw = await fetch(imageUrl);
  if (!raw.ok) throw new Error(`Failed to fetch image: ${raw.status}`);
  const rawBuffer = await raw.arrayBuffer();
  const { buffer, mimeType } = await preprocessImageBuffer(rawBuffer);

  const uint8Array = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  return { base64: btoa(binary), mimeType };
}

/** Fetches multiple image URLs in parallel — used by the comparator, which
 *  needs 2-3 images inlined into a single request. */
export async function fetchImagesAsBase64(
  imageUrls: string[],
): Promise<PreparedImage[]> {
  return Promise.all(imageUrls.map((url) => fetchImageAsBase64(url)));
}