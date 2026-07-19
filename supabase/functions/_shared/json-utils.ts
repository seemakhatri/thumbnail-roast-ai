// _shared/json-utils.ts
//
// Shared JSON extraction/repair helpers for any code that parses a JSON
// object out of an LLM text response. Factored out of ai-analyzer.ts's
// private sanitizeJsonString()/parseAIResponse() pair so new modules
// (research-service.ts, competitor-service.ts, etc.) don't each reinvent
// their own copy. Behavior mirrors ai-analyzer.ts exactly: strip markdown
// code fences, then attempt JSON.parse, then attempt a brace/bracket
// repair pass before giving up.

/** Strips ```json / ``` fences and surrounding whitespace some models
 *  wrap their JSON output in, despite being told not to. */
export function sanitizeJsonString(raw: string): string {
  let text = raw.trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  return text.trim();
}

/** Parses a JSON object out of raw LLM text, attempting a repair pass
 *  (closing unbalanced braces/brackets) if the first parse fails. Throws
 *  a descriptive error if the text still isn't valid JSON afterward. */
export function extractJsonObject<T = Record<string, unknown>>(raw: string): T {
  const cleaned = sanitizeJsonString(raw);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI response contained no JSON object: " + cleaned.slice(0, 300));
    }

    let candidate = match[0];
    const openBraces = (candidate.match(/\{/g) ?? []).length;
    const closeBraces = (candidate.match(/\}/g) ?? []).length;
    const openBrackets = (candidate.match(/\[/g) ?? []).length;
    const closeBrackets = (candidate.match(/\]/g) ?? []).length;
    if (openBrackets > closeBrackets) candidate += "]".repeat(openBrackets - closeBrackets);
    if (openBraces > closeBraces) candidate += "}".repeat(openBraces - closeBraces);

    try {
      return JSON.parse(candidate) as T;
    } catch {
      throw new Error(
        "AI response was invalid JSON even after repair: " + cleaned.slice(0, 500),
      );
    }
  }
}

/** Clamps a possibly-missing/out-of-range numeric score into 0-100. */
export function clampScore(value: number | undefined | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Truncates an array field from an AI response to a max length, so a
 *  model that ignores "return at most N items" can't blow up storage
 *  or the UI. */
export function capList<T>(value: T[] | undefined | null, max: number): T[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max);
}
