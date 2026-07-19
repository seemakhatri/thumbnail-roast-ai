// _shared/apify/client.ts
//
// Generic Apify REST wrapper. This is the ONLY file in the codebase that
// knows Apify's endpoint shape (run-sync-get-dataset-items) and auth
// scheme. Everything actor-specific (which actor ID, what input fields
// it expects, how to interpret its output) lives one layer up in
// _shared/apify/youtube.ts — exactly the split between provider.ts
// (transport-agnostic contract) and openrouter.ts (vendor specifics)
// used for the AI layer.
//
// Env vars read here:
//   APIFY_API_TOKEN     (required — enforced at call time, not at
//                        Config load time, so deploys without Apify
//                        configured yet don't hard-crash on boot)
//   APIFY_TIMEOUT_MS     (per-call timeout; default 60000 — actor runs
//                         are slower than a single LLM call)

import { createLogger } from "../logger.ts";

const logger = createLogger("apify-client");
const APIFY_API_BASE = "https://api.apify.com/v2";
const DEFAULT_TIMEOUT_MS = 60000;

export class ApifyError extends Error {
  constructor(
    public actorId: string,
    public status: number,
    body: string,
  ) {
    super(`[apify:${actorId}] HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "ApifyError";
  }
}

function readTimeoutMs(): number {
  const raw = Deno.env.get("APIFY_TIMEOUT_MS");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function readToken(): string {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) {
    throw new ApifyError("config", 500, "APIFY_API_TOKEN is not configured");
  }
  return token;
}

/**
 * Runs an Apify actor synchronously and returns its dataset items.
 * Uses the `run-sync-get-dataset-items` endpoint, which blocks until the
 * run finishes (or the given timeout) and hands back the dataset
 * directly — no separate poll-for-run-status step needed for the
 * request/response shape this app needs.
 *
 * `actorId` uses Apify's `username~actor-name` or `username/actor-name`
 * form (both accepted by the API); callers pass it in already resolved
 * from an env var (see apify/youtube.ts) so no actor ID is hardcoded
 * here.
 */
export async function runApifyActor<TItem = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
): Promise<TItem[]> {
  const token = readToken();
  const timeoutMs = readTimeoutMs();
  const encodedActorId = actorId.replace("/", "~");
  const url =
    `${APIFY_API_BASE}/acts/${encodedActorId}/run-sync-get-dataset-items?token=${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  logger.info("Running Apify actor", { actorId });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!res.ok) {
      const bodyText = await res.text();
      throw new ApifyError(actorId, res.status, bodyText);
    }

    const items = (await res.json()) as TItem[];
    logger.info("Apify actor run finished", { actorId, itemCount: items.length });
    return items;
  } catch (err) {
    if (err instanceof ApifyError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    // AbortError (timeout) and network failures land here.
    throw new ApifyError(actorId, 504, `Request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
