// _shared/vision-comparator.ts
//
// EXPERT REWRITE. The old version asked a vision model "which is better
// and why" in one shot and trusted whatever it said, including the
// winner and confidence number. Two problems with that:
//   1. It's unauditable — you can't tell a user WHY B won beyond "the AI
//      said so," and identical requests can flip on model noise.
//   2. It ignores everything the analyzer already knows about each
//      image (niche, calibrated per-factor scores) and re-derives
//      judgment from zero, which can silently contradict the original
//      report.
//
// New design: the vision model's ONLY job is to score 8 concrete visual
// factors per thumbnail, side by side (that's what vision models are
// actually good at — relative perception, not arithmetic or business
// logic). Every downstream decision — the weighting, the winner, the
// confidence tier, the per-placement verdicts — is deterministic code
// in this file. That means:
//   - The same inputs always produce the same verdict.
//   - Every verdict can be explained factor-by-factor with real numbers.
//   - The verdict can never silently contradict the original reports,
//     because it's blended with their calibrated stored scores.
//
// Supports 2-way (A/B) and 3-way (A/B/C) comparisons in a single call.

import { CALIBRATION_PREAMBLE, ProviderError } from "./vision-analyzer.ts";
import {
  FactorWeights,
  FACTOR_KEYS,
  FACTOR_LABELS,
  FACTOR_TO_STORED_METRIC,
  PLACEMENT_CONTEXTS,
  PlacementContext,
  weightsForNiche,
  applyPlacement,
} from "./niche-battle-weights.ts";

export type Label = "A" | "B" | "C";

export interface StoredMetrics {
  ctr_score?: number | null;
  readability_score?: number | null;
  emotion_score?: number | null;
  curiosity_score?: number | null;
  mobile_score?: number | null;
  contrast_score?: number | null;
  face_score?: number | null;
  brand_score?: number | null;
  color_score?: number | null;
  visual_appeal_score?: number | null;
  overall_score?: number | null;
}

export interface ThumbnailInput {
  label: Label;
  imageUrl: string;
  niche?: string | null;
  stored?: StoredMetrics;
}

// ── Raw shape returned by the vision model ─────────────────────────────
interface RawFactorEntry {
  A: number;
  B: number;
  C?: number;
  insight: string;
}
interface RawComparisonResponse {
  factors: Record<keyof FactorWeights, RawFactorEntry>;
  swap_suggestion?: string;
  improvement_bullets: Partial<Record<Label, string[]>>;
}

// ── Final, deterministic output shape ───────────────────────────────────
export interface FactorBattle {
  factor: keyof FactorWeights;
  label: string;
  freshScores: Partial<Record<Label, number>>;
  blendedScores: Partial<Record<Label, number>>;
  advantage: Label | "tie";
  insight: string;
}

export interface PlacementVerdict {
  context: PlacementContext;
  label: string;
  blurb: string;
  winner: Label | "tie";
  reason: string;
}

export interface ImprovementStep {
  for: Label;
  title: string;
  steps: string[];
}

export interface CompareVerdict {
  contenders: Label[];
  overallWinner: Label | "tie";
  confidenceTier: "clear_winner" | "close_call" | "context_dependent";
  confidence: number; // 0-100
  headline: string;
  compositeScores: Partial<Record<Label, number>>; // 0-100, niche-weighted
  factorBattles: FactorBattle[];
  placementVerdicts: PlacementVerdict[];
  improvementRoadmap: ImprovementStep[];
  swapSuggestion?: string;
  nicheUsed: string;
  discrepancyNotes: string[];
  provider: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt building
// ─────────────────────────────────────────────────────────────────────────
function buildFactorSchema(labels: Label[]): string {
  const perLabel = labels.map((l) => `"${l}": number`).join(", ");
  return FACTOR_KEYS.map((k) =>
    `    "${k}": { ${perLabel}, "insight": string }  // ${FACTOR_LABELS[k]}`
  ).join(",\n");
}

function buildComparisonPrompt(labels: Label[], niche: string): string {
  const labelList = labels.join(", ");
  const bulletsShape = labels.map((l) => `"${l}": string[]`).join(", ");

  return `${CALIBRATION_PREAMBLE}

You will see ${labels.length} YouTube thumbnails, labeled ${labelList}, being
directly compared for the same "${niche}" niche. Do NOT pick an overall
winner or a confidence score — that is computed separately from your factor
scores. Your ONLY job is to score each thumbnail 0-100 on each of these 8
factors, judging them RELATIVE to each other (not in isolation):

- face: face prominence, size, and expressiveness (0 if no face)
- text: on-thumbnail text legibility at small size (0 if no text)
- contrast: how much the subject pops from the background
- color: palette strength and cohesion
- composition: focal point clarity, framing, use of space
- emotion: how strong the emotional/expressive hook is
- curiosity: how much it creates a "what happens next" pull
- brand: visual consistency / recognizability as a channel style

Be decisive with the numbers — genuinely differentiate them, do not give
near-identical scores out of caution. For each factor's "insight", name the
SPECIFIC visual difference you see between the thumbnails, not a generic
restatement of the numbers.

Also provide:
- "swap_suggestion": one concrete "take X's [element] with Y's [element]"
  idea, only if there's a genuinely useful cross-pollination. Otherwise "".
- "improvement_bullets": for EACH thumbnail (${labelList}), 2-3 short,
  specific, actionable bullets on how that exact thumbnail could improve,
  regardless of whether it's currently ahead.

Return ONLY valid JSON (no markdown fences, no preamble) matching exactly:
{
  "factors": {
${buildFactorSchema(labels)}
  },
  "swap_suggestion": string,
  "improvement_bullets": { ${bulletsShape} }
}`;
}

function safeParseComparison(raw: string, provider: string): RawComparisonResponse {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as RawComparisonResponse;
  } catch {
    throw new ProviderError(provider, 502, `Unparseable JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────
export interface VisionComparator {
  readonly name: string;
  compare(inputs: ThumbnailInput[], apiKey: string): Promise<RawComparisonResponse>;
}

const GEMINI_MODEL = "gemini-flash-lite-latest";

export class OpenRouterComparator implements VisionComparator {
  readonly name = "gemini";

  async compare(inputs: ThumbnailInput[], apiKey: string): Promise<RawComparisonResponse> {
    const labels = inputs.map((i) => i.label);
    const niche = inputs.find((i) => i.niche)?.niche ?? "general";
    const parts: unknown[] = [{ text: buildComparisonPrompt(labels, niche) }];
    for (const input of inputs) {
      parts.push({ text: `Thumbnail ${input.label}:` });
      parts.push({ file_data: { file_uri: input.imageUrl, mime_type: "image/jpeg" } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      },
    );

    if (!res.ok) throw new ProviderError("gemini", res.status, await res.text());

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ProviderError("gemini", 502, "Empty response body");

    return safeParseComparison(text, "gemini");
  }
}

const GROQ_MODEL = "llama-3.2-90b-vision-preview";

export class GroqComparator implements VisionComparator {
  readonly name = "groq";

  async compare(inputs: ThumbnailInput[], apiKey: string): Promise<RawComparisonResponse> {
    const labels = inputs.map((i) => i.label);
    const niche = inputs.find((i) => i.niche)?.niche ?? "general";
    const content: unknown[] = [{ type: "text", text: buildComparisonPrompt(labels, niche) }];
    for (const input of inputs) {
      content.push({ type: "text", text: `Thumbnail ${input.label}:` });
      content.push({ type: "image_url", image_url: { url: input.imageUrl } });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) throw new ProviderError("groq", res.status, await res.text());

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("groq", 502, "Empty response body");

    return safeParseComparison(text, "groq");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic verdict computation — the trust-building core
// ─────────────────────────────────────────────────────────────────────────
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeVerdict(
  inputs: ThumbnailInput[],
  raw: RawComparisonResponse,
  provider: string,
): CompareVerdict {
  const labels = inputs.map((i) => i.label);
  const niche = inputs.find((i) => i.niche)?.niche ?? "general";
  const weights = weightsForNiche(niche);
  const discrepancyNotes: string[] = [];

  // ── Blend fresh vision scores with each report's calibrated history ───
  const factorBattles: FactorBattle[] = FACTOR_KEYS.map((factorKey) => {
    const raw_entry = raw.factors[factorKey];
    const freshScores: Partial<Record<Label, number>> = {};
    const blendedScores: Partial<Record<Label, number>> = {};

    for (const input of inputs) {
      const fresh = clamp(raw_entry[input.label] ?? 0);
      freshScores[input.label] = fresh;

      const storedField = FACTOR_TO_STORED_METRIC[factorKey] as keyof StoredMetrics;
      const stored = input.stored?.[storedField];

      if (typeof stored === "number") {
        blendedScores[input.label] = clamp(fresh * 0.6 + stored * 0.4);
        if (Math.abs(fresh - stored) > 25) {
          discrepancyNotes.push(
            `${input.label}'s fresh ${FACTOR_LABELS[factorKey].toLowerCase()} score (${fresh}) differs sharply from its original report (${stored}) — thumbnails can read differently side-by-side than alone.`,
          );
        }
      } else {
        blendedScores[input.label] = fresh;
      }
    }

    const sorted = [...labels].sort((a, b) => (blendedScores[b] ?? 0) - (blendedScores[a] ?? 0));
    const top = blendedScores[sorted[0]] ?? 0;
    const second = blendedScores[sorted[1]] ?? 0;
    const advantage: Label | "tie" = top - second < 4 ? "tie" : sorted[0];

    return {
      factor: factorKey,
      label: FACTOR_LABELS[factorKey],
      freshScores,
      blendedScores,
      advantage,
      insight: raw_entry.insight ?? "",
    };
  });

  // ── Base niche-weighted composite ──────────────────────────────────────
  const compositeScores: Partial<Record<Label, number>> = {};
  for (const l of labels) {
    let total = 0;
    for (const fb of factorBattles) {
      total += weights[fb.factor] * (fb.blendedScores[l] ?? 0);
    }
    compositeScores[l] = clamp(total);
  }

  const rankedLabels = [...labels].sort(
    (a, b) => (compositeScores[b] ?? 0) - (compositeScores[a] ?? 0),
  );
  const top = compositeScores[rankedLabels[0]] ?? 0;
  const second = compositeScores[rankedLabels[1]] ?? 0;
  const gap = top - second;

  let confidenceTier: CompareVerdict["confidenceTier"];
  let overallWinner: Label | "tie";
  if (gap < 4) {
    confidenceTier = "context_dependent";
    overallWinner = "tie";
  } else if (gap < 12) {
    confidenceTier = "close_call";
    overallWinner = rankedLabels[0];
  } else {
    confidenceTier = "clear_winner";
    overallWinner = rankedLabels[0];
  }
  const confidence = clamp(50 + gap * 2.2);

  // ── Headline: name the factor that drove the win ───────────────────────
  let headline: string;
  if (overallWinner === "tie") {
    headline = `Too close to call overall — the right pick depends on where this video will be seen.`;
  } else {
    const driverFactor = [...factorBattles]
      .filter((fb) => fb.advantage === overallWinner)
      .sort((a, b) => weights[b.factor] - weights[a.factor])[0];
    const driverName = driverFactor ? driverFactor.label.toLowerCase() : "overall strength";
    const margin = confidenceTier === "clear_winner" ? "a clear margin" : "a narrow margin";
    headline = `Thumbnail ${overallWinner} wins by ${margin}, driven mainly by ${driverName}.`;
  }

  // ── Placement verdicts ─────────────────────────────────────────────────
  const placementVerdicts: PlacementVerdict[] = PLACEMENT_CONTEXTS.map((ctx) => {
    const placementWeights = applyPlacement(weights, ctx.id);
    const scores: Partial<Record<Label, number>> = {};
    for (const l of labels) {
      let t = 0;
      for (const fb of factorBattles) t += placementWeights[fb.factor] * (fb.blendedScores[l] ?? 0);
      scores[l] = clamp(t);
    }
    const ranked = [...labels].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
    const pTop = scores[ranked[0]] ?? 0;
    const pSecond = scores[ranked[1]] ?? 0;
    const winner: Label | "tie" = pTop - pSecond < 4 ? "tie" : ranked[0];

    const topFactorHere = [...FACTOR_KEYS].sort(
      (a, b) => placementWeights[b] - placementWeights[a],
    )[0];

    const reason = winner === "tie"
      ? `Both perform similarly here.`
      : `${FACTOR_LABELS[topFactorHere]} matters most on this surface, and ${winner} leads there (${scores[winner]} vs ${scores[ranked[1]]}).`;

    return { context: ctx.id, label: ctx.label, blurb: ctx.blurb, winner, reason };
  });

  // ── Improvement roadmap — surfaced for whoever isn't the clear winner ──
  const needsRoadmap = overallWinner === "tie" ? labels : labels.filter((l) => l !== overallWinner);
  const improvementRoadmap: ImprovementStep[] = needsRoadmap.map((l) => {
    const bullets = raw.improvement_bullets?.[l] ?? [];
    const weakestFactor = [...factorBattles]
      .filter((fb) => fb.advantage !== l && fb.advantage !== "tie")
      .sort((a, b) => weights[b.factor] - weights[a.factor])[0];
    const title = weakestFactor
      ? `Close the gap on ${weakestFactor.label}`
      : `Sharpen the details`;
    return { for: l, title, steps: bullets };
  });

  return {
    contenders: labels,
    overallWinner,
    confidenceTier,
    confidence,
    headline,
    compositeScores,
    factorBattles,
    placementVerdicts,
    improvementRoadmap,
    swapSuggestion: raw.swap_suggestion || undefined,
    nicheUsed: niche,
    discrepancyNotes,
    provider,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Resilient wrapper
// ─────────────────────────────────────────────────────────────────────────
export interface ComparatorConfig {
  comparator: VisionComparator;
  apiKey: string | undefined;
}

export async function compareWithFallback(
  inputs: ThumbnailInput[],
  providers: ComparatorConfig[],
): Promise<CompareVerdict> {
  const errors: string[] = [];

  for (const { comparator, apiKey } of providers) {
    if (!apiKey) continue;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await comparator.compare(inputs, apiKey);
        return computeVerdict(inputs, raw, comparator.name);
      } catch (err) {
        const isTransient =
          err instanceof ProviderError && (err.status === 429 || err.status >= 500);
        errors.push(err instanceof Error ? err.message : String(err));

        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`All comparison providers failed: ${errors.join(" | ")}`);
}