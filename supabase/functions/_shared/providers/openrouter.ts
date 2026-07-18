// _shared/providers/openrouter.ts
//
// OpenRouter implementation of AIProvider. This is the ONLY file in the
// codebase that knows OpenRouter's endpoint and request/response shape.
// Everything is driven by environment variables — there is no hardcoded
// model name anywhere below. Point OPENROUTER_MODEL at any vision-capable
// model on https://openrouter.ai/models and this file keeps working
// unchanged.
//
// Env vars read here:
//   OPENROUTER_API_KEY  (required — enforced by config.ts / callers)
//   OPENROUTER_MODEL    (required at call time; falls back to
//                        "openrouter/free" only if unset, so local/dev
//                        setups don't hard-crash before secrets are
//                        configured — production should always set this
//                        explicitly)
//   AI_TIMEOUT_MS       (per-attempt request timeout; default 30000)
//   AI_MAX_RETRIES      (retries AFTER the first attempt on transient
//                        errors — 429 / 5xx / timeout; default 2)
//
// Retry policy: exponential backoff with jitter, identical shape to the
// backoff previously used in gemini.ts's callGemini() (attempt * base +
// random jitter), just parameterized by AI_MAX_RETRIES instead of a
// fixed loop count. Non-transient errors (4xx other than 429) fail fast
// with no retry, since retrying a bad request/auth error never helps.

import type { AIGenerateParams, AIProvider } from "./provider.ts";
import { ProviderError } from "./provider.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

function readModel(): string {
  return Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_MODEL;
}

function readTimeoutMs(): number {
  const raw = Deno.env.get("AI_TIMEOUT_MS");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function readMaxRetries(): number {
  const raw = Deno.env.get("AI_MAX_RETRIES");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_RETRIES;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// ── OpenRouter (OpenAI-compatible) request/response shapes ────────────────
interface OpenRouterContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface OpenRouterMessage {
  role: "user";
  content: OpenRouterContentPart[];
}

interface OpenRouterRequestBody {
  model: string;
  messages: OpenRouterMessage[];
  temperature: number;
  max_tokens: number;
}

interface OpenRouterChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
    refusal?: string | null;
  };
  finish_reason?: string;
}

interface OpenRouterResponseBody {
  choices?: OpenRouterChoice[];
  error?: { message?: string; code?: number | string };
}

function extractText(body: OpenRouterResponseBody): string {
  const choice = body.choices?.[0];
  if (!choice) return "";

  const content = choice.message?.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .filter((part) => part && (part.type === "text" || part.text))
      .map((part) => part.text ?? "")
      .join("");
  }

  return "";
}

async function postWithTimeout(
  body: OpenRouterRequestBody,
  apiKey: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    // Optional but recommended by OpenRouter for attribution/analytics on
    // their dashboard. Harmless to omit if not configured.
    const referer = Deno.env.get("FRONTEND_ORIGIN") || Deno.env.get("ALLOWED_ORIGIN");
    if (referer) headers["HTTP-Referer"] = referer;
    headers["X-Title"] = "Thumbnail Roast";

    return await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  async generate(params: AIGenerateParams): Promise<string> {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      throw new ProviderError("openrouter", 500, "OPENROUTER_API_KEY is not configured");
    }

    const model = readModel();
    const timeoutMs = readTimeoutMs();
    const maxRetries = readMaxRetries();

    const content: OpenRouterContentPart[] = [{ type: "text", text: params.prompt }];
    for (const image of params.images) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      });
    }

    const body: OpenRouterRequestBody = {
      model,
      messages: [{ role: "user", content }],
      temperature: params.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    };

    const errors: string[] = [];
    const totalAttempts = maxRetries + 1;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      let res: Response;
      try {
        res = await postWithTimeout(body, apiKey, timeoutMs);
      } catch (err) {
        // Network failure or timeout (AbortError) — treat as transient.
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`attempt ${attempt}: ${message}`);
        if (attempt < totalAttempts) {
          await backoff(attempt);
          continue;
        }
        throw new ProviderError(
          "openrouter",
          504,
          `Request failed after ${totalAttempts} attempt(s): ${errors.join(" | ")}`,
        );
      }

      if (res.ok) {
        const data = (await res.json()) as OpenRouterResponseBody;
        const text = extractText(data);
        if (!text) {
          const refusal = data.choices?.[0]?.message?.refusal;
          throw new ProviderError(
            "openrouter",
            502,
            refusal ? `Model refused: ${refusal}` : "Empty response body",
          );
        }
        return text;
      }

      const bodyText = await res.text();
      errors.push(`attempt ${attempt}: HTTP ${res.status}: ${bodyText.slice(0, 200)}`);

      if (isTransientStatus(res.status) && attempt < totalAttempts) {
        await backoff(attempt);
        continue;
      }

      throw new ProviderError("openrouter", res.status, bodyText);
    }

    // Unreachable, but keeps the compiler happy about a return on every path.
    throw new ProviderError("openrouter", 500, `Unknown failure: ${errors.join(" | ")}`);
  }
}

function backoff(attempt: number): Promise<void> {
  const jitter = Math.random() * 500;
  const delay = attempt * 1500 + jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
}