import { AnalysisMetrics, ThumbnailAnalysis } from "./types.ts";
import { KNOWLEDGE_GRAPH } from "./knowledge-graph.ts";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// IMPORTANT: verify these are current before deploying — Google renames/
// retires free-tier models every few months (gemini-2.0-flash, which used
// to be the fallback here, was retired in March 2026). Check
// https://ai.google.dev/gemini-api/docs/models for the live list.
// Pulling these from env means a model rename is a config change, not a
// redeploy.
const MODEL_PRIMARY =
  Deno.env.get("GEMINI_MODEL_PRIMARY") ?? "gemini-flash-lite-latest";
const MODEL_FALLBACK =
  Deno.env.get("GEMINI_MODEL_FALLBACK") ?? "gemini-2.5-flash";

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

// ── BUILD NICHE-AWARE SYSTEM PROMPT ───────────────────────────────────────
function buildScoringPrompt(niche: string): string {
  const weights = NICHE_WEIGHTS[niche] ?? NICHE_WEIGHTS["general"];

  return `You are ThumbnailRoast's CTR Prediction Engine v4.1.

DETECTED NICHE: ${niche.toUpperCase()}

NICHE CONTEXT: ${weights.notes}

${GROUNDING_BLOCK}

Your ONLY job is to evaluate this thumbnail through the lens of what ACTUALLY drives clicks
in the ${niche} niche — NOT generic YouTube advice.

## SCORE CALIBRATION — READ CAREFULLY
Score across the FULL 0-100 range based on what you actually see. Do NOT
default to a "safe" middle score out of caution.
- 90-100: Elite — the kind of thumbnail that drives millions of views.
- 75-89: Strong — most elements land well, minor weaknesses only.
- 55-74: Average — functional but forgettable. Most amateur thumbnails
  belong here, but do not land here by default — many genuinely deserve
  below 55 or above 75.
- 35-54: Below average — a clear, fixable weakness in the primary hook.
- 0-34: Needs work — no clear focal point or actively confusing.
If a thumbnail has a stunning visual hook for this niche (exceptional face,
composition, color, or visual appeal as appropriate), score it 85+. Do not
hedge downward "just in case" — that's the single most common scoring
mistake, and it makes genuinely great thumbnails indistinguishable from
mediocre ones.

## STEP 1: Score 8 Signals (each 0-100)

Use these NICHE-SPECIFIC weights for ${niche} (for your own reasoning only —
the server applies these weights itself, you do not need to compute the
final overall_score):
- Face Signal:         ${Math.round(weights.face * 100)}%
- Text Signal:         ${Math.round(weights.text * 100)}%
- Curiosity Gap:       ${Math.round(weights.curiosity * 100)}%
- Composition:         ${Math.round(weights.composition * 100)}%
- Contrast:            ${Math.round(weights.contrast * 100)}%
- Color:               ${Math.round(weights.color * 100)}%
- Brand:               ${Math.round(weights.brand * 100)}%
- Visual Appeal:       ${Math.round(weights.visual_appeal * 100)}%

### FACE SIGNAL scoring for ${niche}:
${
  niche === "art_creative"
    ? `- 0-30: No face — THIS IS NORMAL AND ACCEPTABLE for art thumbnails
- Score face high (60+) ONLY if the person is shown with the finished artwork in a meaningful way
- A thumbnail with NO face but EXCELLENT artwork should still score 70+ overall`
    : niche === "food_cooking"
      ? `- 0-30: No face — acceptable, food is the star
- Never penalize a food thumbnail for having no face`
      : niche === "travel"
        ? `- 0-40: No face or person visible — acceptable if location is stunning`
        : `- 0-20: No face visible
- 21-40: Face present but neutral
- 41-60: Face with mild emotion
- 61-80: Face with clear emotion (surprise, excitement, anger)
- 81-100: Face with EXTREME emotion + eye contact + great lighting`
}

### TEXT SIGNAL scoring for ${niche}:
Report this as "readability_score". IMPORTANT: for niches where text is
optional (art, food, travel), the ABSENCE of text is not a defect — if
there is no text and this niche doesn't require it, score readability_score
70-80 to indicate "no penalty," not near 0. Only score low when text IS
present but illegible or cluttered.
${
  niche === "art_creative"
    ? `- 81-100: 1-3 words that create curiosity, OR no text at all with stunning artwork
- 61-80: 1 clean phrase, readable on mobile
- 0-60: Multiple text blocks, labels, or cluttered process descriptions`
    : niche === "finance_business"
      ? `- 81-100: Bold number/claim that creates FOMO ($10K, 300% returns, I QUIT)
- 61-80: Clear promise with specific outcome
- 0-60: Generic or vague text`
      : `- 0-20: Text present but unreadable on mobile
- 21-40: Text present but too small or too many words
- 41-60: 1-3 words, readable on mobile
- 61-80: 1-3 words, high contrast, clear hierarchy
- 81-100: 1-3 POWERFUL words, perfect contrast, elite hierarchy`
}

### CURIOSITY GAP scoring for ${niche}:
${
  niche === "art_creative"
    ? `- 81-100: Clear transformation OR exceptionally stunning artwork that makes viewer think "I MUST see this in detail"
- 61-80: Strong artistic hook — unusual subject, impressive detail, or a beautiful in-progress shot
- 0-60: Generic artwork, viewer knows exactly what to expect`
    : `- 0-20: No curiosity — viewer knows what happens
- 21-40: Mild curiosity
- 41-60: Clear question or "how did they do that?"
- 61-80: Strong "what happens next?" hook
- 81-100: Elite "I MUST know" hook`
}

### COMPOSITION scoring for ${niche}:
Report this as "composition_score" — this is a DISTINCT signal from
contrast. Composition is about framing and use of space; contrast is about
visual separation between elements. Score them independently.
${
  niche === "art_creative"
    ? `- 81-100: Artwork dominates 70-80% of frame, perfect rule-of-thirds, no wasted space
- 61-80: Artwork is main subject, clean composition with good use of space
- 41-60: Artwork visible but poor framing or too much empty space
- 0-40: Artwork not clearly the main subject, cluttered layout`
    : `- 0-20: Cluttered, no clear focus
- 21-40: Main subject identifiable but poor framing
- 41-60: Decent composition, subject clear
- 61-80: Strong composition, good hierarchy
- 81-100: Elite composition, professional framing`
}

### VISUAL APPEAL scoring (report as "visual_appeal_score"):
${
  niche === "art_creative"
    ? `- 81-100: Artwork is breathtaking — viewer stops scrolling just to admire it
- 61-80: Beautiful artwork that clearly shows skill and effort
- 41-60: Nice, pleasant but not extraordinary
- 0-40: Average or unclear`
    : niche === "food_cooking"
      ? `- 81-100: Food looks absolutely irresistible — perfect lighting, vibrant colors
- 61-80: Very appetizing, well-presented
- 0-60: Decent to unappealing`
      : niche === "travel"
        ? `- 81-100: Location looks breathtaking — viewer immediately wants to go there
- 61-80: Beautiful, aspirational
- 0-60: Average to boring`
        : `- 81-100: Exceptional visual quality — professional, polished, eye-catching
- 61-80: High quality, clearly well-produced
- 0-60: Decent to amateur-looking`
}

### CONTRAST scoring (report as "contrast_score", distinct from composition):
- 0-20: Flat, no contrast between elements
- 21-40: Low contrast, elements blend together
- 41-60: Moderate contrast
- 61-80: Strong contrast, elements pop
- 81-100: Elite contrast, subject immediately grabs attention

### COLOR scoring for ${niche} (report as "color_score"):
${
  niche === "art_creative"
    ? `- 81-100: Vibrant, rich colors that make the artwork pop
- 0-60: Dull, muddy, or washed-out`
    : niche === "food_cooking"
      ? `- 81-100: Vibrant food colors — fresh greens, rich reds, golden browns
- 0-60: Dull, unappetizing colors`
      : `- 0-40: Dull or poor color choices
- 41-60: Decent
- 61-80: Strong palette, visually engaging
- 81-100: Elite, vibrant, attention-grabbing`
}

### BRAND scoring (report as "brand_score"):
- 0-20: No brand consistency  •  21-40: Minimal  •  41-60: Some elements
- 61-80: Clear identity  •  81-100: Elite recognition

## STEP 2: Verdict (based on your own read of overall quality)
- 0-39: "needs_work"  •  40-59: "decent"  •  60-74: "good"
- 75-89: "strong"  •  90-100: "excellent"

## STEP 3: Recommendations
Each recommendation MUST reference a SPECIFIC element visible in THIS
thumbnail, explain WHY it matters for CTR in the ${niche} niche specifically,
and give a CONCRETE alternative — never generic advice like "improve your face."

## OUTPUT FORMAT (EXACT — return this and nothing else, no markdown fences):
{
  "overall_score": 0,
  "verdict": "needs_work",
  "roast_title": "[3-5 word critique specific to this niche]",
  "roast": "[2-3 sentence brutally honest analysis through the lens of what works in ${niche}]",
  "metrics": {
    "ctr_score": 0,
    "readability_score": 0,
    "emotion_score": 0,
    "curiosity_score": 0,
    "mobile_score": 0,
    "contrast_score": 0,
    "composition_score": 0,
    "face_score": 0,
    "brand_score": 0,
    "color_score": 0,
    "visual_appeal_score": 0
  },
  "strengths": ["strength specific to ${niche} niche"],
  "weaknesses": ["weakness specific to ${niche} niche"],
  "recommendations": [
    {
      "title": "Fix [specific element]",
      "description": "Currently [describe exact problem]. For ${niche} thumbnails, change to [concrete alternative]. This works because [niche-specific reason].",
      "priority": "high",
      "category": "visual",
      "impact": "+X% CTR"
    }
  ],
  "competitor_insights": ["what top ${niche} creators do differently"],
  "niche": "${niche}",
  "thumbnail_style": "",
  "face_present": false,
  "text_present": false,
  "text_count": 0,
  "has_arrow": false,
  "has_circle": false
}`;
}

// ── IMAGE PREPROCESSING (unchanged) ───────────────────────────────────────
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

function parseGeminiResponse(
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
        "Gemini returned unparseable response: " + cleaned.slice(0, 300),
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
        "Gemini returned invalid JSON even after repair: " +
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

// ── GEMINI CALLER ──────────────────────────────────────────────────────────
async function buildBase64(
  imageUrl: string,
): Promise<{ base64: string; mimeType: string }> {
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

async function callGemini(
  model: string,
  payload: unknown,
  apiKey: string,
  retries = 2,
): Promise<Response> {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return response;
    if (response.status !== 503 && response.status !== 429) return response;

    console.log(
      `Gemini overloaded (${response.status}). Retry ${attempt}/${retries}`,
    );
    const backoff = attempt * 1500 + Math.random() * 500; // jittered backoff
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw new Error("Gemini unavailable after retries");
}

async function runGemini(
  prompt: string,
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 20,
      topP: 0.9,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  let response = await callGemini(MODEL_PRIMARY, payload, apiKey);
  if (!response.ok) {
    console.warn(
      `Primary model failed (${response.status}), falling back to ${MODEL_FALLBACK}`,
    );
    response = await callGemini(MODEL_FALLBACK, payload, apiKey);
  }
  if (!response.ok) {
    throw new Error(
      `Gemini API error ${response.status}: ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates.");
  if (candidate.finishReason === "SAFETY")
    throw new Error("Image blocked by Gemini safety filters.");

  const text =
    candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned empty response.");
  return text;
}

export function normalizeNiche(niche: string | undefined | null): string {
  const n = niche ?? "general";
  return Object.keys(NICHE_WEIGHTS).includes(n) ? n : "general";
}

async function detectNiche(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  try {
    const raw = await runGemini(NICHE_DETECT_PROMPT, base64, mimeType, apiKey);
    const parsed = JSON.parse(sanitizeJsonString(raw)) as { niche?: string };
    const niche = parsed.niche ?? "general";
    return Object.keys(NICHE_WEIGHTS).includes(niche) ? niche : "general";
  } catch (e) {
    console.warn("Niche detection failed, defaulting to general:", e);
    return "general";
  }
}

// ── MAIN EXPORT: single-pass analysis ──────────────────────────────────────
// Two Gemini calls total (niche detect + one scoring pass), down from four.
export async function analyzeThumbnail(
  imageUrl: string,
  apiKey: string,
): Promise<ThumbnailAnalysis> {
  const { base64, mimeType } = await buildBase64(imageUrl);
  const niche = await detectNiche(base64, mimeType, apiKey);
  console.log(`Detected niche: ${niche}`);

  const rawText = await runGemini(
    buildScoringPrompt(niche),
    base64,
    mimeType,
    apiKey,
  );
  return parseGeminiResponse(rawText, niche);
}

// ── STABLE VARIANT: configurable pass count, defaults to 1 ────────────────
// Your original always ran 3 parallel passes regardless of plan — that's
// what was burning 4 Gemini calls per single user analysis. Default this
// to 1 pass (2 calls total including niche detect) and only spend the
// extra quota on multi-pass averaging for plans that can absorb it.
//
//   analyzeThumbnailStable(url, key)        -> 1 pass  (2 Gemini calls)
//   analyzeThumbnailStable(url, key, 3)     -> 3 passes (4 Gemini calls) —
//                                              reserve this for creator/agency
export async function analyzeThumbnailStable(
  imageUrl: string,
  apiKey: string,
  passes = 1,
): Promise<ThumbnailAnalysis> {
  const { base64, mimeType } = await buildBase64(imageUrl);
  const niche = await detectNiche(base64, mimeType, apiKey);
  console.log(
    `Stable analysis (${passes} pass${passes > 1 ? "es" : ""}) — detected niche: ${niche}`,
  );

  const scoringPrompt = buildScoringPrompt(niche);

  if (passes <= 1) {
    const rawText = await runGemini(scoringPrompt, base64, mimeType, apiKey);
    return parseGeminiResponse(rawText, niche);
  }

  const results = await Promise.all(
    Array.from({ length: passes }, () =>
      runGemini(scoringPrompt, base64, mimeType, apiKey).then((raw) =>
        parseGeminiResponse(raw, niche),
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