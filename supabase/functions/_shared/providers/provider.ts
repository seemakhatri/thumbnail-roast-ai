// _shared/providers/provider.ts
//
// Provider-agnostic contract for AI vision calls. Every concrete provider
// (openrouter.ts today; add more later by implementing this interface and
// registering them in index.ts) implements AIProvider. Nothing outside this
// providers/ folder is allowed to know about vendor-specific request/response
// shapes, endpoints, or model names — analyzer and comparator code call
// `provider.generate(...)` and get back a raw text string, exactly the way
// gemini.ts used to get back `candidate.content.parts[0].text`.
//
// This is what makes the model swappable purely by environment variable:
// as long as OPENROUTER_MODEL points at *some* vision-capable model on
// OpenRouter, no code in this repo needs to change.

/** A single image to attach to a generation request, already fetched and
 *  base64-encoded (see _shared/image-prep.ts). Providers are never handed
 *  a bare remote URL — some OpenRouter models fetch remote URLs
 *  unreliably, so every caller sends inline image bytes instead. */
export interface AIImageInput {
  base64: string;
  mimeType: string;
}

export interface AIGenerateParams {
  /** Full text prompt, including any grounding/calibration/response-shape
   *  instructions. Never modified by a provider implementation. */
  prompt: string;
  /** 1 image for single-thumbnail analysis, 2-3 for compare. */
  images: AIImageInput[];
  /** Defaults to a low, deterministic-leaning value if omitted. */
  temperature?: number;
  /** Defaults to a generous cap if omitted. */
  maxOutputTokens?: number;
}

export interface AIProvider {
  /** Short, lowercase identifier used in logs and stored in the
   *  `analyzed_by` column (e.g. "openrouter"). */
  readonly name: string;

  /** Runs one generation call and returns the raw text response.
   *  Implementations own their own timeout/retry/backoff behavior and
   *  throw ProviderError for anything the caller might want to react to
   *  (e.g. to decide whether to fail over to a different provider). */
  generate(params: AIGenerateParams): Promise<string>;
}

/** Thrown by provider implementations on any non-2xx response or on a
 *  response that doesn't contain usable content. `status` lets callers
 *  (analyzeWithFallback, compareWithFallback, retry loops) distinguish
 *  transient errors (429 / 5xx) from permanent ones. */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    body: string,
  ) {
    super(`[${provider}] HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "ProviderError";
  }
}