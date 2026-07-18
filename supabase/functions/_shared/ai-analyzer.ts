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

import { AnalysisMetrics, ThumbnailAnalysis } from "./types.ts";
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

// ── NICHE-AWARE SCORING WEIGHTS ────────────────────────────────────────────
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
You are a **brutally honest, 20‑year YouTube veteran** who has seen millions of thumbnails. Your feedback is **specific, data‑driven, and actionable** – never vague. You hate generic advice like “improve your face” or “make it pop.” You always reference **exact visual elements** you see.

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

## STEP 3: Roast – brutally honest, specific, and actionable

Write a **2‑3 sentence roast** that:
- Directly addresses the **main issue** you see.
- Mentions **specific visual elements** (e.g., “the red text in the bottom‑right”, “the subject’s neutral expression”).
- Tells the creator **exactly why** it’s hurting CTR **in their niche**.

Then, provide a **shareable one‑liner** (max 70 characters) that summarises the key weakness – perfect for social media.

## STEP 4: Strengths & Weaknesses (3 each)

- **Strengths:** What actually works well in this thumbnail, **citing specific elements**.
- **Weaknesses:** What is **actively hurting** CTR, again **citing specific elements**. Be ruthless.

## STEP 5: Recommendations (3 recommendations, sorted by priority)

Each recommendation MUST:
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
  "roast_title": "short, 3‑5 word critique",
  "roast": "2‑3 sentence brutal, specific roast",
  "share_one_liner": "max 70 chars, shareable summary",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "recommendations": [
    {
      "title": "Fix [specific element]",
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

function scoreToVerdict(score: number): ThumbnailAnalysis["verdict"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "decent";
  return "needs_work";
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

  const result: ThumbnailAnalysis = {
    overall_score: overallScore,
    verdict: scoreToVerdict(overallScore),
    roast_title: parsed.roast_title ?? "",
    roast: parsed.roast ?? "",
    strengths: (parsed.strengths ?? []).slice(0, 5),
    weaknesses: (parsed.weaknesses ?? []).slice(0, 5),
    recommendations: (parsed.recommendations ?? []).slice(0, 5),
    competitor_insights: (parsed.competitor_insights ?? []).slice(0, 5),
    metrics,
    niche,
    thumbnail_style: parsed.thumbnail_style ?? "",
    face_present: parsed.face_present ?? false,
    text_present: parsed.text_present ?? false,
    text_count: textCount,
    has_arrow: parsed.has_arrow ?? false,
    has_circle: parsed.has_circle ?? false,
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

// ── STABLE VARIANT: configurable pass count, defaults to 1 ────────────────
// Your original always ran 3 parallel passes regardless of plan — that's
// what was burning 4 calls per single user analysis. Default this to 1
// pass (2 calls total including niche detect) and only spend the extra
// quota on multi-pass averaging for plans that can absorb it.
//
//   analyzeThumbnailStable(url)        -> 1 pass  (2 AI calls)
//   analyzeThumbnailStable(url, 3)     -> 3 passes (4 AI calls) — reserve
//                                          this for creator/agency plans
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
    return parseAIResponse(rawText, niche);
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

  return {
    ...results[0],
    overall_score: overallScore,
    verdict: scoreToVerdict(overallScore),
    metrics: averagedMetrics,
  };
}