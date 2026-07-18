// _shared/providers/index.ts
//
// Provider factory. Callers (ai-analyzer.ts, vision-analyzer.ts,
// vision-comparator.ts) never construct a provider class directly — they
// call getAIProvider() and get back whatever AI_PROVIDER selects. Today
// that's only "openrouter", but adding a second provider later means:
//   1. implement AIProvider in providers/<name>.ts
//   2. add one case to the switch below
// No other file in the codebase needs to change.

import type { AIProvider } from "./provider.ts";
import { OpenRouterProvider } from "./openrouter.ts";

export type { AIGenerateParams, AIImageInput, AIProvider } from "./provider.ts";
export { ProviderError } from "./provider.ts";
export { OpenRouterProvider } from "./openrouter.ts";

const DEFAULT_PROVIDER = "openrouter";

// Providers are cheap, stateless wrappers around fetch — one shared
// instance per provider name is enough, cached so repeated calls within
// the same isolate don't reallocate.
const instances = new Map<string, AIProvider>();

function readProviderName(): string {
  return (Deno.env.get("AI_PROVIDER")?.trim() || DEFAULT_PROVIDER).toLowerCase();
}

/** Returns the AIProvider selected by the AI_PROVIDER env var (defaults
 *  to "openrouter" if unset). Throws if AI_PROVIDER is set to something
 *  unrecognized, so misconfiguration fails loudly at call time instead
 *  of silently falling back to a provider the operator didn't ask for. */
export function getAIProvider(): AIProvider {
  const name = readProviderName();

  const cached = instances.get(name);
  if (cached) return cached;

  let provider: AIProvider;
  switch (name) {
    case "openrouter":
      provider = new OpenRouterProvider();
      break;
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${name}". Supported providers: openrouter.`,
      );
  }

  instances.set(name, provider);
  return provider;
}

/** Returns the env var name that must hold the API key for the currently
 *  selected provider. Used by config.ts to validate required secrets
 *  without hardcoding a provider-specific key name in two places. */
export function getRequiredApiKeyEnvVar(): string {
  const name = readProviderName();
  switch (name) {
    case "openrouter":
      return "OPENROUTER_API_KEY";
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${name}". Supported providers: openrouter.`,
      );
  }
}