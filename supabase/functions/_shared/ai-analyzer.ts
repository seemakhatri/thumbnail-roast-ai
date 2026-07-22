// _shared/ai-analyzer.ts  (formerly gemini.ts)
//
// Renamed as part of the Gemini -> OpenRouter migration. Every prompt,
// niche weight table, and scoring formula below is UNCHANGED from the
// original gemini.ts — only the network layer changed: instead of calling
// Google's generateContent REST API directly, this file now calls
// getAIProvider().generate(), which resolves to whichever provider
// AI_PROVIDER selects (OpenRouterProvider today). The model name is never
// hardcoded here — it comes from OPENROUTER_MODEL, read inside
// providers/openrouter.ts.

import { AnalysisMetrics, Recommendation, ThumbnailAnalysis } from "./types.ts";
import { KNOWLEDGE_GRAPH } from "./knowledge-graph.ts";
import { fetchImageAsBase64 } from "./image-prep.ts";
import { getAIProvider } from "./providers/index.ts";

// ── NICHE DETECTION PROMPT (unchanged) ─────────────────────────────────────
const NICHE_DETECT_PROMPT = `You are a YouTube niche classifier.

Look at this thumbnail and return ONLY a JSON object. No markdown. No explanation.

Classify into ONE of these niches:
- "art_creative"        (painting, drawing, illustration, sculpture, craft, DIY art)
- "gaming"              (gameplay, reviews, gaming news, esports)
- "finance_business"    (investing, money, entrepreneurship, career)
- "tech"                (software, hardware, AI, coding, gadgets)
- "fitness_health"      (workout, nutrition, wellness, mental health)
- "food_cooking"        (recipes, restaurants, baking, mukbang)
- "education"           (tutorials, explainers, science, history, language)
- "entertainment"       (comedy, vlogs, reactions, challenges, lifestyle)
- "beauty_fashion"      (makeup, skincare, style, fashion)
- "travel"              (destinations, vlogs, tips)
- "music"               (music videos, production, instruments)
- "sports"              (sports news, highlights, analysis)
- "general"             (anything that doesn't fit above)

Return exactly:
{
  "niche": "art_creative",
  "confidence": "high"
}`;

// ─── NICHE-AWARE SCORING WEIGHTS ────────────────────────────────────────────
// Unchanged from your version — the weights themselves were fine. The bug
// was in how `composition` got READ during scoring (see buildOverallScore
// below), not in these numbers.
export const NICHE_WEIGHTS: Record<
  string,
  {
    face: number;
    text: number;
    curiosity: number;
    composition: number;
    contrast: number;
    color: number;
    brand: number;
    visual_appeal: number;
    notes: string;
  }
> = {
  art_creative: {
    face: 0.05,
    text: 0.08,
    curiosity: 0.22,
    composition: 0.22,
    contrast: 0.08,
    color: 0.15,
    brand: 0.02,
    visual_appeal: 0.18,
    notes:
      "Art thumbnails are driven by artwork quality, vibrant colors, and visual impressiveness. Transformation curiosity (before/after) is ONE effective strategy but NOT required. An in-progress shot showing beautiful artwork with visible tools/hand can be equally effective. The art itself can be the hook. DO NOT penalize thumbnails that lack transformation if the artwork is visually stunning. Score visual_appeal based on how impressive/beautiful the artwork looks regardless of format.",
  },
  food_cooking: {
    face: 0.08,
    text: 0.15,
    curiosity: 0.15,
    composition: 0.15,
    contrast: 0.1,
    color: 0.18,
    brand: 0.04,
    visual_appeal: 0.15,
    notes:
      "Food thumbnails are driven by making the food look irresistible. Color, visual appeal, and composition of the dish are more important than face. Mouth-watering presentation is the primary hook. Score visual_appeal on how delicious and appealing the food looks.",
  },
  travel: {
    face: 0.08,
    text: 0.15,
    curiosity: 0.2,
    composition: 0.18,
    contrast: 0.08,
    color: 0.14,
    brand: 0.04,
    visual_appeal: 0.13,
    notes:
      "Travel thumbnails are driven by stunning visuals and curiosity about the destination. Color, composition, and visual appeal of the location matter more than face. Score visual_appeal on how breathtaking/desirable the location looks.",
  },
  beauty_fashion: {
    face: 0.18,
    text: 0.15,
    curiosity: 0.18,
    composition: 0.15,
    contrast: 0.08,
    color: 0.1,
    brand: 0.04,
    visual_appeal: 0.12,
    notes:
      "Beauty thumbnails need polished composition, good lighting, and visual appeal. Transformation (before/after) is a strong hook. Clean, aesthetic presentation matters. Score visual_appeal on overall polished look and aesthetic quality.",
  },
  entertainment: {
    face: 0.28,
    text: 0.18,
    curiosity: 0.22,
    composition: 0.08,
    contrast: 0.06,
    color: 0.06,
    brand: 0.02,
    visual_appeal: 0.1,
    notes:
      "Entertainment thumbnails live and die by facial expression and emotional hook. Extreme expressions, dramatic reactions, and curiosity gaps dominate. Score visual_appeal on production quality and polish.",
  },
  gaming: {
    face: 0.18,
    text: 0.22,
    curiosity: 0.22,
    composition: 0.08,
    contrast: 0.08,
    color: 0.06,
    brand: 0.04,
    visual_appeal: 0.12,
    notes:
      "Gaming thumbnails need strong text hooks and emotional faces. Curiosity gaps work well. Brand consistency matters. Score visual_appeal on graphic design quality and visual impact.",
  },
  finance_business: {
    face: 0.12,
    text: 0.32,
    curiosity: 0.22,
    composition: 0.1,
    contrast: 0.1,
    color: 0.04,
    brand: 0.02,
    visual_appeal: 0.08,
    notes:
      "Finance thumbnails are TEXT-driven. Bold numbers and claims drive clicks. Face adds authority but is secondary. Score visual_appeal on professional presentation and credibility.",
  },
  tech: {
    face: 0.12,
    text: 0.25,
    curiosity: 0.22,
    composition: 0.12,
    contrast: 0.08,
    color: 0.05,
    brand: 0.04,
    visual_appeal: 0.12,
    notes:
      "Tech thumbnails need clear product/subject visibility and a strong text hook. Face adds personality but the product shot often matters more. Score visual_appeal on product presentation quality.",
  },
  fitness_health: {
    face: 0.22,
    text: 0.22,
    curiosity: 0.18,
    composition: 0.08,
    contrast: 0.08,
    color: 0.06,
    brand: 0.04,
    visual_appeal: 0.12,
    notes:
      "Fitness thumbnails often show body transformation or intensity. Face with extreme expression + bold claim is classic formula. Score visual_appeal on transformation impact and physique presentation.",
  },
  education: {
    face: 0.12,
    text: 0.3,
    curiosity: 0.28,
    composition: 0.08,
    contrast: 0.05,
    color: 0.04,
    brand: 0.02,
    visual_appeal: 0.11,
    notes:
      "Education thumbnails need a clear text promise. Curiosity gap is critical. Face adds approachability but content promise is #1. Score visual_appeal on clarity of visual explanations.",
  },
  music: {
    face: 0.14,
    text: 0.18,
    curiosity: 0.18,
    composition: 0.18,
    contrast: 0.08,
    color: 0.1,
    brand: 0.04,
    visual_appeal: 0.1,
    notes:
      "Music thumbnails vary widely. Artist recognition and mood/vibe matter. Aesthetic composition is important.",
  },
  sports: {
    face: 0.18,
    text: 0.22,
    curiosity: 0.22,
    composition: 0.12,
    contrast: 0.08,
    color: 0.04,
    brand: 0.02,
    visual_appeal: 0.12,
    notes: "Sports thumbnails need action, emotion, and a strong text hook.",
  },
  general: {
    face: 0.18,
    text: 0.22,
    curiosity: 0.18,
    composition: 0.1,
    contrast: 0.08,
    color: 0.06,
    brand: 0.04,
    visual_appeal: 0.14,
    notes: "General scoring — balanced approach with visual appeal weighted.",
  },
};

// ── EXTENDED METRICS ────────────────────────────────────────────────────
// AnalysisMetrics (in types.ts) doesn't have a composition_score field —
// that's the root of the double-counting bug. Add this one line to your
// types.ts AnalysisMetrics interface:
//
//   composition_score: number;
//
// Until you do, this file works with a locally-extended type so it still
// compiles, but you should add the field to the shared type so the rest
// of your codebase (frontend, DB inserts) can see it too.
interface ScoredMetrics extends AnalysisMetrics {
  composition_score: number;
}

// ── GROUNDING BLOCK — built once from the sourced knowledge graph ────────
// Keeps the model's reasoning anchored to real YouTube documentation and
// explicit "never assume" guardrails instead of drifting back toward
// generic advice (e.g. "no face = bad") over time or across model swaps.
const NEVER_ASSUME = KNOWLEDGE_GRAPH.signals_the_analyzer_should_never_assume
  .map((s) => `- ${s}`)
  .join("\n");

// A small, hand-picked subset of verified_youtube_facts most relevant to
// per-thumbnail scoring (not the whole graph — keeps prompt length sane).
const RELEVANT_FACTS = KNOWLEDGE_GRAPH.verified_youtube_facts
  .filter((f) => ["yt-003", "yt-004", "yt-006"].includes(f.id))
  .map((f) => `- ${f.fact}`)
  .join("\n");

const GROUNDING_BLOCK = `## GROUNDING — treat these as fixed constraints, not suggestions
Verified YouTube guidance:
${RELEVANT_FACTS}

Never assume any of the following:
${NEVER_ASSUME}`;

function buildScoringPrompt(niche: string): string {
  const weights = NICHE_WEIGHTS[niche] ?? NICHE_WEIGHTS["general"];

  return `You are ThumbnailRoast's CTR Prediction Engine v5.0 – **elite‑grade** analysis.

DETECTED NICHE: ${niche.toUpperCase()}

${GROUNDING_BLOCK}

## ROLE & TONE
You are an **experienced YouTube growth strategist**, not a critic. Your job is NOT to find something wrong with every thumbnail — your job is to predict whether changing this thumbnail would meaningfully move CTR. Most of the thumbnails you see are fine. Some are genuinely excellent. You are just as comfortable saying "this already works, ship it" as you are saying "this specific thing is costing you clicks." Confidence in either direction is the goal — reflexive criticism is a failure mode, not thoroughness.

You still reference **exact visual elements** you see, whether you're praising or critiquing. You never use vague, generic language ("improve your face", "make it pop") in either direction.

## SCORING PHILOSOPHY
Score across the **full 0‑100 spectrum** – do not cluster in the middle. Use these anchors:

| Score | Meaning |
|-------|---------|
| 90‑100 | **Elite** – would stop any scroll in any niche. Perfect contrast, irresistible hook. |
| 75‑89 | **Strong** – clear hook, minor execution issues. |
| 55‑74 | **Average** – functional but forgettable. Most amateur thumbnails live here, but do **not** default here. |
| 35‑54 | **Below average** – missing a clear hook or has a critical flaw. |
| 0‑34 | **Needs work** – confusing, cluttered, or fails to communicate anything. |

**Rule:** If you see a genuinely strong thumbnail, score it 85+ without hesitation. Do not hedge.

## STEP 1: Score each signal (0‑100) – BE DECISIVE

For each signal, write **one sentence** explaining your score – this is mandatory.

### 1. FACE SIGNAL (weight ${Math.round(weights.face * 100)}%)
- **0‑20**: No face visible.
- **21‑40**: Face present but neutral / poorly lit.
- **41‑60**: Face with mild emotion, decent size.
- **61‑80**: Face with clear emotion (surprise, excitement, anger), good size and lighting.
- **81‑100**: Face with **EXTREME** emotion, eye contact, perfect lighting, fills ~30% of frame.

**Niche note:** ${niche === "art_creative" ? "Faces are NOT required; a faceless thumbnail can score 80+ if the artwork is stunning." : "Faces are important but not mandatory – if there's no face and the niche doesn't require it, score 40‑50 to indicate 'no penalty'."}

### 2. TEXT SIGNAL (readability_score) (weight ${Math.round(weights.text * 100)}%)
- **0‑20**: Text present but unreadable on mobile.
- **21‑40**: Text too small, too many words, or low contrast.
- **41‑60**: 1‑3 words, readable but not eye‑catching.
- **61‑80**: 1‑3 bold words, high contrast, clear hierarchy.
- **81‑100**: 1‑3 **POWERFUL** words (e.g., “$10K”, “I QUIT”, “GAME OVER”), perfect contrast, elite typography.

**Niche note:** ${niche === "art_creative" ? "Text is optional; if absent, score 70‑80 to indicate 'no penalty'." : "Text is often essential; score low if missing when it would help."}

### 3. CURIOSITY GAP (weight ${Math.round(weights.curiosity * 100)}%)
- **0‑20**: No curiosity – viewer knows exactly what will happen.
- **21‑40**: Mild question, but answer is obvious.
- **41‑60**: Clear “how did they do that?” or “what happens next?” hook.
- **61‑80**: Strong “I MUST know” hook.
- **81‑100**: Elite “I can’t NOT click” hook – rare.

### 4. COMPOSITION (weight ${Math.round(weights.composition * 100)}%)
- **0‑20**: Cluttered, no clear focus.
- **21‑40**: Main subject identifiable but poor framing.
- **41‑60**: Decent composition, subject clear.
- **61‑80**: Strong composition, good hierarchy.
- **81‑100**: Elite, professional framing – rule‑of‑thirds, perfect balance.

### 5. CONTRAST (weight ${Math.round(weights.contrast * 100)}%)
- **0‑20**: Flat, elements blend together.
- **21‑40**: Low contrast.
- **41‑60**: Moderate contrast.
- **61‑80**: Strong contrast, subject pops.
- **81‑100**: Elite, subject immediately separates from background.

### 6. COLOR (weight ${Math.round(weights.color * 100)}%)
- ${niche === "art_creative" ? "**0‑60**: Dull, muddy, or washed‑out. **61‑80**: Vibrant, rich colors. **81‑100**: Breathtaking, professional palette." : "**0‑40**: Dull or poor choices. **41‑60**: Decent. **61‑80**: Strong, engaging palette. **81‑100**: Elite, attention‑grabbing."}

### 7. VISUAL APPEAL (weight ${Math.round(weights.visual_appeal * 100)}%)
- ${niche === "art_creative" ? "**0‑40**: Average art. **41‑60**: Nice but not extraordinary. **61‑80**: Beautiful, clearly skilled. **81‑100**: Breathtaking – viewer stops just to admire." : "**0‑40**: Amateur‑looking. **41‑60**: Decent quality. **61‑80**: High quality, polished. **81‑100**: Professional, cinematic quality."}

### 8. BRAND (weight ${Math.round(weights.brand * 100)}%)
- **0‑20**: No brand consistency.
- **21‑40**: Minimal.
- **41‑60**: Some elements.
- **61‑80**: Clear identity.
- **81‑100**: Elite recognition – unmistakably yours.

## STEP 2: Overall Score & Verdict

Compute the weighted average (the server does the math, but you should reason about it). Then assign the verdict:

- **90‑100**: “excellent”
- **75‑89**: “strong”
- **60‑74**: “good”
- **40‑59**: “decent”
- **0‑39**: “needs_work”

## STEP 2.5: Classify tier, then decide if change is even worth it — DO THIS BEFORE WRITING ANYTHING ELSE

First, classify into exactly one tier:
- **elite** (roughly score 88+): would stop scroll in any niche, nothing meaningfully wrong.
- **strong** (roughly 70-87): clearly working, may have one real lever left.
- **average** (roughly 45-69): functional but forgettable, or a mix of real strengths and real problems.
- **weak** (below 45): a clear structural problem is suppressing CTR.

Then ask yourself, honestly: **"If this creator changes anything about this thumbnail, is CTR likely to improve by a meaningful, defensible amount?"**

- If the tier is **elite**, the answer is almost always **NO**. Set changes_recommended: false. Do not go looking for something to fix to justify your existence — a confident "this works, ship it" is the correct, valuable output.
- If the tier is **strong**, the answer is often still NO unless there's one specific, visible lever with real expected impact — not a cosmetic tweak.
- If the tier is **average** or **weak**, the answer is usually YES, and there is real work to do below.

This decision gates everything in Steps 3-5. It is not optional and it is not a formality — treat "no changes needed" as an equally valid, equally confident output as "here's what to fix."

## STEP 3: Roast — calibrated, not obligated to criticize

If changes_recommended is **false**: write the SAME 2-3 confident sentences into BOTH \`roast\` and \`why_it_works\` — naming the specific visual elements that make this thumbnail work and why they'll drive clicks in this niche. \`roast\` must never be an empty string, even in this branch — "no critique" does not mean "no text," it means the text is positive instead of critical. Set \`roast_title\` to match (e.g. "Already elite — ship it"). Do NOT manufacture a weakness to sound balanced.

If changes_recommended is **true**: write a **2‑3 sentence roast** that:
- Directly addresses the **main issue** you see.
- Mentions **specific visual elements** (e.g., “the red text in the bottom‑right”, “the subject’s neutral expression”).
- Tells the creator **exactly why** it’s hurting CTR **in their niche**.

Then, provide a **shareable one‑liner** (max 70 characters) — either the key weakness or, for elite thumbnails, the key strength.

## STEP 4: Strengths & Weaknesses

- **Strengths:** What actually works well, **citing specific elements**. Always populate this — even a weak thumbnail usually has 1-2 things going for it.
- **Weaknesses:** Only include something here if it is clearly visible AND actively hurting CTR. This array is allowed to be **empty** — an elite or strong thumbnail with nothing genuinely wrong should return [], not a padded-out list of nitpicks dressed up as flaws.

## STEP 5: Recommendations — only if changes_recommended is true

If changes_recommended is **false**, recommendations MUST be an empty array []. Do not include "optional" or "minor" suggestions just to fill the field — an empty array is the correct, confident answer.

If changes_recommended is **true**, include only recommendations that satisfy **ALL FOUR** of these bars — drop anything that fails even one:
1. The issue is clearly visible in the image, not inferred or speculative.
2. Fixing it is likely to improve CTR, not just make the thumbnail "nicer."
3. The expected impact is meaningful — not a marginal, sub-5% nudge.
4. The recommendation is specific and actionable — a creator could execute it today without guessing.

This usually means **1-3** recommendations, sorted by priority — never pad to a fixed count. One sharp, high-confidence recommendation beats three filler ones.

Each recommendation you do include MUST:
- Have a **title** that names the specific element to fix.
- Have a **description** that explains:
  - What’s wrong now (with a direct reference to the image).
  - **What to change exactly** (concrete instruction, e.g., “increase the face size from 15% to 30% of the frame”).
  - **Why** this change drives CTR in this niche (refer to niche‑specific psychology).
- Include a **priority**: “high”, “medium”, or “low”.
- Include a **category**: “visual”, “text”, “emotion”, “composition”.
- Include an **impact estimate** with a **percentage range** (e.g., “+12‑18% CTR”) – be realistic.

## STEP 6: Competitor Insights (3 insights)

What do **top creators in this niche** do differently? Provide **specific, non‑generic** observations, e.g.:
- “Top gaming creators often use exaggerated facial expressions and a single bold word.”
- “Top food creators never add text; they let the food’s color and composition sell it.”

## STEP 7: Additional Metadata

- **thumbnail_style**: one of “process_showcase”, “before_after”, “face_centric”, “text_driven”, “product_focus”, etc.
- **face_present**: boolean.
- **text_present**: boolean.
- **text_count**: number.
- **has_arrow**: boolean.
- **has_circle**: boolean.

## OUTPUT FORMAT – EXACT JSON, no markdown

{
  "overall_score": number,
  "verdict": "needs_work" | "decent" | "good" | "strong" | "excellent",
  "tier": "elite" | "strong" | "average" | "weak",
  "changes_recommended": boolean,
  "roast_title": "short, 3‑5 word summary — critique OR praise, whichever applies",
  "roast": "2‑3 sentences: brutal + specific if changes_recommended is true, confident + specific if false",
  "why_it_works": "2‑3 sentences naming specific elements that work — ONLY populated when changes_recommended is false, otherwise empty string",
  "share_one_liner": "max 70 chars, shareable summary of the key weakness OR key strength",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "weaknesses": ["specific weakness 1 — omit entirely, this array can be []"],
  "recommendations": [
    {
      "title": "Fix [specific element] — this whole array is [] when changes_recommended is false",
      "description": "Currently [exact problem]. For ${niche} thumbnails, change to [concrete alternative]. This works because [niche‑specific reason].",
      "priority": "high" | "medium" | "low",
      "category": "visual" | "text" | "emotion" | "composition",
      "impact": "+X‑Y% CTR"
    }
  ],
  "competitor_insights": [
    "what top ${niche} creators do differently (specific observation 1)",
    "specific observation 2",
    "specific observation 3"
  ],
  "metrics": {
    "ctr_score": number,
    "readability_score": number,
    "emotion_score": number,
    "curiosity_score": number,
    "mobile_score": number,
    "contrast_score": number,
    "composition_score": number,
    "face_score": number,
    "brand_score": number,
    "color_score": number,
    "visual_appeal_score": number
  },
  "niche": "${niche}",
  "thumbnail_style": string,
  "face_present": boolean,
  "text_present": boolean,
  "text_count": number,
  "has_arrow": boolean,
  "has_circle": boolean
}`;
}

// ── JSON HELPERS ───────────────────────────────────────────────────────────
function sanitizeJsonString(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// ── THE ACTUAL SCORE FORMULA — this is where bug #2 lived ────────────────
// Reads composition_score as its own signal instead of reusing
// contrast_score twice. This is the entire fix for the "stuck at 68-69"
// symptom, combined with the graduated boosts below replacing the flat
// Math.max(computed, 65) floor.
function computeOverallScore(
  metrics: ScoredMetrics,
  niche: string,
  textCount: number,
): number {
  const weights = NICHE_WEIGHTS[niche] ?? NICHE_WEIGHTS["general"];

  let computed = Math.round(
    metrics.face_score * weights.face +
      metrics.readability_score * weights.text +
      metrics.curiosity_score * weights.curiosity +
      metrics.composition_score * weights.composition + // fixed: was contrast_score
      metrics.contrast_score * weights.contrast +
      metrics.color_score * weights.color +
      metrics.brand_score * weights.brand +
      metrics.visual_appeal_score * weights.visual_appeal,
  );

  // Universal safety net — only for genuinely bad contrast, not a ceiling.
  if (metrics.contrast_score < 30) computed = Math.min(computed, 60);

  // Graduated boosts, not a single flat floor. A truly elite visual/color
  // combination should land near 90, not be indistinguishable from a
  // merely-good one at 65.
  const visualDriven = ["art_creative", "food_cooking", "travel"].includes(
    niche,
  );
  if (visualDriven) {
    if (metrics.visual_appeal_score >= 85 && metrics.color_score >= 80) {
      computed = Math.max(computed, 88);
    } else if (metrics.visual_appeal_score >= 70 && metrics.color_score >= 70) {
      computed = Math.max(computed, 75);
    }
  }

  if (niche === "art_creative" && textCount > 4) {
    computed -= 10;
  }

  return Math.max(0, Math.min(100, computed));
}

// Model compliance isn't perfect: sometimes instead of returning [] it
// returns [""] or ["  "] — a single empty/whitespace string. That renders in
// the UI as an empty bullet or tag, which reads as broken, not as "nothing
// to report." Strip these defensively rather than trusting the prompt alone.
function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function scoreToVerdict(score: number): ThumbnailAnalysis["verdict"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "decent";
  return "needs_work";
}

// Backend-derived fallback if the model omits `tier` — keeps the decision
// tree meaningful even on a malformed response, and gives us a value to
// cross-check the model's own tier against.
function scoreToTier(score: number): ThumbnailAnalysis["tier"] {
  if (score >= 88) return "elite";
  if (score >= 70) return "strong";
  if (score >= 45) return "average";
  return "weak";
}

// Pulls the upper bound out of an impact string like "+12-18% CTR" so we can
// enforce the "meaningful impact" bar server-side, independent of whether the
// model actually followed the prompt's four-part bar for recommendations.
function impactUpperBound(impact: string): number {
  const matches = impact.match(/(\d+)/g);
  if (!matches || matches.length === 0) return 0;
  return Math.max(...matches.map(Number));
}

// ── SAFETY NET — enforces "no changes recommended" even if the model drifts ──
// This is deliberately independent of prompt compliance: prompts get ignored
// sometimes (model swaps, temperature drift, long context). The trust problem
// this whole redesign exists to fix is too important to leave to the prompt
// alone, so we re-derive and enforce here:
//   - elite-tier scores never surface recommendations, no matter what the
//     model returned, unless contrast is genuinely broken (see the
//     computeOverallScore safety net above, which already caps score in
//     that case — so if score reads elite, contrast wasn't the issue).
//   - any individual recommendation under the "meaningful impact" bar
//     (< 8% upper-bound CTR lift) is dropped rather than shown.
//   - if every recommendation gets dropped, changes_recommended flips to
//     false and why_it_works falls back to a generic-but-honest note built
//     from the strengths the model already gave us.
function enforceRecommendationPolicy(
  score: number,
  aiChangesRecommended: boolean,
  recommendations: Recommendation[],
  strengths: string[],
  whyItWorks: string,
): { changes_recommended: boolean; recommendations: Recommendation[]; why_it_works: string } {
  const tier = scoreToTier(score);
  const MEANINGFUL_IMPACT_FLOOR = 8; // percent, upper bound of the range

  let filtered = recommendations.filter(
    (r) => impactUpperBound(r.impact ?? "") >= MEANINGFUL_IMPACT_FLOOR,
  );

  // Elite thumbnails don't get recommendations from this backend, full stop —
  // this is the actual fix for "always finds something to criticize," applied
  // as code, not just as a prompt request.
  if (tier === "elite") {
    filtered = [];
  }

  const changesRecommended = aiChangesRecommended && filtered.length > 0;

  const fallbackWhyItWorks =
    whyItWorks ||
    (strengths.length
      ? `This already works: ${strengths.slice(0, 2).join("; ")}.`
      : "No changes are recommended — nothing here is likely to move CTR meaningfully.");

  return {
    changes_recommended: changesRecommended,
    recommendations: changesRecommended ? filtered.slice(0, 3) : [],
    why_it_works: changesRecommended ? "" : fallbackWhyItWorks,
  };
}

function parseAIResponse(
  rawText: string,
  niche: string,
): ThumbnailAnalysis {
  const cleaned = sanitizeJsonString(rawText);
  let parsed: Partial<ThumbnailAnalysis> & { metrics?: Partial<ScoredMetrics> };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Initial JSON parse failed, attempting repair…");
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match)
      throw new Error(
        "AI provider returned unparseable response: " + cleaned.slice(0, 300),
      );

    let candidate = match[0];
    const openBraces = (candidate.match(/\{/g) ?? []).length;
    const closeBraces = (candidate.match(/\}/g) ?? []).length;
    const openBrackets = (candidate.match(/\[/g) ?? []).length;
    const closeBrackets = (candidate.match(/\]/g) ?? []).length;
    if (openBrackets > closeBrackets)
      candidate += "]".repeat(openBrackets - closeBrackets);
    if (openBraces > closeBraces)
      candidate += "}".repeat(openBraces - closeBraces);

    try {
      parsed = JSON.parse(candidate);
    } catch {
      throw new Error(
        "AI provider returned invalid JSON even after repair: " +
          cleaned.slice(0, 500),
      );
    }
  }

  const clamp = (v: number | undefined) => Math.max(0, Math.min(100, v ?? 0));

  const metrics: ScoredMetrics = {
    ctr_score: clamp(parsed.metrics?.ctr_score),
    readability_score: clamp(parsed.metrics?.readability_score),
    emotion_score: clamp(parsed.metrics?.emotion_score),
    curiosity_score: clamp(parsed.metrics?.curiosity_score),
    mobile_score: clamp(parsed.metrics?.mobile_score),
    contrast_score: clamp(parsed.metrics?.contrast_score),
    composition_score: clamp(parsed.metrics?.composition_score),
    face_score: clamp(parsed.metrics?.face_score),
    brand_score: clamp(parsed.metrics?.brand_score),
    color_score: clamp(parsed.metrics?.color_score),
    visual_appeal_score: clamp(parsed.metrics?.visual_appeal_score),
  };

  const textCount = parsed.text_count ?? 0;
  const overallScore = computeOverallScore(metrics, niche, textCount);

  const policy = enforceRecommendationPolicy(
    overallScore,
    parsed.changes_recommended ?? (parsed.recommendations ?? []).length > 0,
    (parsed.recommendations ?? []) as Recommendation[],
    parsed.strengths ?? [],
    parsed.why_it_works ?? "",
  );

  const cleanStrengths = sanitizeStringArray(parsed.strengths);
  // Enforce that weaknesses are empty when changes_recommended is false
  const cleanWeaknesses = policy.changes_recommended
    ? sanitizeStringArray(parsed.weaknesses)
    : [];

  // Never let the UI show a blank roast quote. If the model left it empty —
  // this does happen despite the prompt instruction — fall back to
  // why_it_works (no-changes path) or a strength-derived line (has-changes
  // path), so there is always something honest to display.
  const roast =
    (parsed.roast ?? "").trim() ||
    policy.why_it_works ||
    (cleanStrengths.length
      ? `${cleanStrengths[0]}${cleanStrengths[1] ? " " + cleanStrengths[1] : ""}`
      : "");
  const roastTitle =
    (parsed.roast_title ?? "").trim() ||
    (policy.changes_recommended ? "Room to improve" : "Already elite — ship it");

  // ── Compute publish decision and executive summary ──────────────────────
  const publishDecision = determinePublishDecision({
    overallScore,
    tier: parsed.tier ?? scoreToTier(overallScore),
    changesRecommended: policy.changes_recommended,
    recommendations: policy.recommendations,
    strengths: cleanStrengths,
  });

  const executiveSummary = generateExecutiveSummary({
    overallScore,
    tier: parsed.tier ?? scoreToTier(overallScore),
    changesRecommended: policy.changes_recommended,
    recommendations: policy.recommendations,
    strengths: cleanStrengths,
    publishDecision,
  });

  const result: ThumbnailAnalysis = {
    overall_score: overallScore,
    verdict: scoreToVerdict(overallScore),
    tier: parsed.tier ?? scoreToTier(overallScore),
    changes_recommended: policy.changes_recommended,
    roast_title: roastTitle,
    roast,
    why_it_works: policy.why_it_works,
    strengths: cleanStrengths.slice(0, 5),
    weaknesses: cleanWeaknesses.slice(0, 5),
    recommendations: policy.recommendations,
    competitor_insights: sanitizeStringArray(parsed.competitor_insights).slice(0, 5),
    metrics,
    niche,
    thumbnail_style: parsed.thumbnail_style ?? "",
    face_present: parsed.face_present ?? false,
    text_present: parsed.text_present ?? false,
    text_count: textCount,
    has_arrow: parsed.has_arrow ?? false,
    has_circle: parsed.has_circle ?? false,
    // NEW FIELDS
    publish_decision: publishDecision.decision,
    executive_summary: executiveSummary,
  };

  return result;
}

// ── AI PROVIDER CALLER ──────────────────────────────────────────────────
// Replaces the old callGemini()/runGemini() pair. Retries, timeout, and
// backoff now live inside the provider implementation (see
// providers/openrouter.ts) so this function is provider-agnostic — it
// never sees a status code or a model name, only a finished text response
// or a thrown error.
async function runAIProvider(
  prompt: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const provider = getAIProvider();
  const text = await provider.generate({
    prompt,
    images: [{ base64, mimeType }],
    temperature: 0.1,
    maxOutputTokens: 4096,
  });

  if (!text) throw new Error(`${provider.name} returned empty response.`);
  return text;
}

export function normalizeNiche(niche: string | undefined | null): string {
  const n = niche ?? "general";
  return Object.keys(NICHE_WEIGHTS).includes(n) ? n : "general";
}

async function detectNiche(base64: string, mimeType: string): Promise<string> {
  try {
    const raw = await runAIProvider(NICHE_DETECT_PROMPT, base64, mimeType);
    const parsed = JSON.parse(sanitizeJsonString(raw)) as { niche?: string };
    const niche = parsed.niche ?? "general";
    return Object.keys(NICHE_WEIGHTS).includes(niche) ? niche : "general";
  } catch (e) {
    console.warn("Niche detection failed, defaulting to general:", e);
    return "general";
  }
}

// ── MAIN EXPORT: single-pass analysis ──────────────────────────────────────
// Two AI calls total (niche detect + one scoring pass), down from four.
export async function analyzeThumbnail(
  imageUrl: string,
): Promise<ThumbnailAnalysis> {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
  const niche = await detectNiche(base64, mimeType);

  const rawText = await runAIProvider(
    buildScoringPrompt(niche),
    base64,
    mimeType,
  );
  return parseAIResponse(rawText, niche);
}

// ── PUBLISH DECISION & EXECUTIVE SUMMARY ──────────────────────────────────
// These helpers are used by both parseAIResponse and analyzeThumbnailStable
// to generate consistent, trust-building output.

function determinePublishDecision(params: {
  overallScore: number;
  tier: ThumbnailAnalysis["tier"];
  changesRecommended: boolean;
  recommendations: Recommendation[];
  strengths: string[];
}): {
  decision: "publish" | "publish_after_minor_changes" | "rework";
  label: string;
  reason: string;
} {
  const { overallScore, tier, changesRecommended, recommendations, strengths } = params;

  const hasCritical = recommendations.some((r) => r.priority === "high");
  const hasMedium = recommendations.some((r) => r.priority === "medium");

  // Rule 1: Elite or Strong with no critical issues → publish
  if ((tier === "elite" || tier === "strong") && !hasCritical && !changesRecommended) {
    return {
      decision: "publish",
      label: "✅ Publish As-Is",
      reason: `This thumbnail is already ${tier} — it's ready to perform.`,
    };
  }

  // Rule 2: Average with only minor/medium issues → publish after minor changes
  if (tier === "average" && !hasCritical && changesRecommended) {
    const suggestion = recommendations.length > 0
      ? recommendations[0].title
      : "minor improvements";
    return {
      decision: "publish_after_minor_changes",
      label: "⚠️ Publish After Minor Changes",
      reason: `This thumbnail is solid, but ${suggestion} could boost CTR.`,
    };
  }

  // Rule 3: Weak or critical issues → rework
  if (tier === "weak" || hasCritical) {
    const criticalCount = recommendations.filter((r) => r.priority === "high").length;
    return {
      decision: "rework",
      label: "❌ Rework Before Publishing",
      reason: `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} need${criticalCount > 1 ? "" : "s"} attention before this thumbnail can perform.`,
    };
  }

  // Fallback (should not happen)
  return {
    decision: "publish_after_minor_changes",
    label: "⚠️ Review Before Publishing",
    reason: "Consider the recommendations below to maximise CTR.",
  };
}

function generateExecutiveSummary(params: {
  overallScore: number;
  tier: ThumbnailAnalysis["tier"];
  changesRecommended: boolean;
  recommendations: Recommendation[];
  strengths: string[];
  publishDecision: {
    decision: "publish" | "publish_after_minor_changes" | "rework";
    label: string;
    reason: string;
  };
}): string {
  const { overallScore, tier, changesRecommended, recommendations, strengths, publishDecision } = params;

  const strengthSummary = strengths.length > 0
    ? `Strengths: ${strengths.slice(0, 2).join("; ")}.`
    : "";

  if (!changesRecommended || recommendations.length === 0) {
    return `This thumbnail is ${tier} (${overallScore}/100). ${strengthSummary} No changes needed — publish with confidence.`;
  }

  const criticalCount = recommendations.filter((r) => r.priority === "high").length;
  const totalCount = recommendations.length;

  let action = "";
  if (criticalCount > 0) {
    action = `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} require fixing.`;
  } else {
    action = `${totalCount} minor improvement${totalCount > 1 ? "s" : ""} suggested.`;
  }

  return `This thumbnail is ${tier} (${overallScore}/100). ${strengthSummary} ${action} ${publishDecision.reason}`;
}

// ── STABLE VARIANT: configurable pass count, defaults to 1 ────────────────
// Your original always ran 3 parallel passes regardless of plan — that's
// what was burning 4 calls per single user analysis. Default this to 1
// pass (2 calls total including niche detect) and only spend the extra
// quota on multi-pass averaging for plans that can absorb it.
//
//   analyzeThumbnailStable(url)        -> 1 pass  (2 AI calls)
//   analyzeThumbnailStable(url, 3)     -> 3 passes (4 AI calls) — reserve
//                                        this for creator/agency plans
export async function analyzeThumbnailStable(
  imageUrl: string,
  passes = 1,
): Promise<ThumbnailAnalysis> {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
  const niche = await detectNiche(base64, mimeType);
  console.log(
    `Stable analysis (${passes} pass${passes > 1 ? "es" : ""}) — detected niche: ${niche}`,
  );

  const scoringPrompt = buildScoringPrompt(niche);

  if (passes <= 1) {
    const rawText = await runAIProvider(scoringPrompt, base64, mimeType);
    const analysis = parseAIResponse(rawText, niche);
    // We already have publish_decision and executive_summary from parseAIResponse
    return analysis;
  }

  const results = await Promise.all(
    Array.from({ length: passes }, () =>
      runAIProvider(scoringPrompt, base64, mimeType).then((raw) =>
        parseAIResponse(raw, niche),
      ),
    ),
  );

  const avg = (vals: number[]) =>
    Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

  const averagedMetrics: ScoredMetrics = {
    ctr_score: avg(results.map((r) => r.metrics.ctr_score)),
    readability_score: avg(results.map((r) => r.metrics.readability_score)),
    emotion_score: avg(results.map((r) => r.metrics.emotion_score)),
    curiosity_score: avg(results.map((r) => r.metrics.curiosity_score)),
    mobile_score: avg(results.map((r) => r.metrics.mobile_score)),
    contrast_score: avg(results.map((r) => r.metrics.contrast_score)),
    composition_score: avg(
      results.map((r) => (r.metrics as ScoredMetrics).composition_score ?? 0),
    ),
    face_score: avg(results.map((r) => r.metrics.face_score)),
    brand_score: avg(results.map((r) => r.metrics.brand_score)),
    color_score: avg(results.map((r) => r.metrics.color_score)),
    visual_appeal_score: avg(results.map((r) => r.metrics.visual_appeal_score)),
  };

  const overallScore = computeOverallScore(
    averagedMetrics,
    niche,
    results[0].text_count ?? 0,
  );

  // Majority vote across passes on whether change is worth it at all, then
  // re-run the same safety net against the AVERAGED score — not pass 0's
  // score — so a pass that happened to score higher/lower doesn't leave a
  // stale set of recommendations attached to a now-different overall score.
  const changesVotes = results.filter((r) => r.changes_recommended).length;
  const changesRecommendedMajority = changesVotes > results.length / 2;
  // Use the recommendations from whichever pass most closely matches the
  // averaged score, so the wording stays coherent with the final metrics.
  const closestPass = results.reduce((best, r) =>
    Math.abs(r.overall_score - overallScore) <
    Math.abs(best.overall_score - overallScore)
      ? r
      : best,
  );

  const policy = enforceRecommendationPolicy(
    overallScore,
    changesRecommendedMajority,
    closestPass.recommendations,
    closestPass.strengths,
    closestPass.why_it_works,
  );

  // Re-enforce weaknesses clearing for the averaged result
  const cleanWeaknesses = policy.changes_recommended
    ? sanitizeStringArray(closestPass.weaknesses)
    : [];

  // ── Compute publish decision and executive summary for the averaged result ──
  const finalTier = scoreToTier(overallScore);
  const publishDecision = determinePublishDecision({
    overallScore,
    tier: finalTier,
    changesRecommended: policy.changes_recommended,
    recommendations: policy.recommendations,
    strengths: closestPass.strengths,
  });

  const executiveSummary = generateExecutiveSummary({
    overallScore,
    tier: finalTier,
    changesRecommended: policy.changes_recommended,
    recommendations: policy.recommendations,
    strengths: closestPass.strengths,
    publishDecision,
  });

  return {
    ...closestPass,
    overall_score: overallScore,
    verdict: scoreToVerdict(overallScore),
    tier: finalTier,
    changes_recommended: policy.changes_recommended,
    recommendations: policy.recommendations,
    why_it_works: policy.why_it_works,
    weaknesses: cleanWeaknesses.slice(0, 5),
    metrics: averagedMetrics,
    publish_decision: publishDecision.decision,
    executive_summary: executiveSummary,
  };
}