// _shared/vision-analyzer.ts
//
// Resilient, multi-provider vision analysis with automatic fallback.
// Chain (configured by caller): Gemini Flash-Lite -> Groq (Llama vision)
//
// Every provider implements the same VisionAnalyzer interface so the
// calling function never knows (or cares) which one actually answered.
// This solves two separate problems at once:
//   1. Free-tier rate limits (15-30 RPM on Gemini alone) — Groq has a
//      completely separate quota bucket, so overflow traffic doesn't 429.
//   2. A single point of failure — if Gemini is down or rate-limited,
//      the user still gets an analysis instead of an error.

import type { ThumbnailAnalysis } from "./types.ts";

export interface VisionAnalyzer {
  readonly name: string;
  analyze(imageUrl: string, apiKey: string): Promise<ThumbnailAnalysis>;
}

export class ProviderError extends Error {
  constructor(public provider: string, public status: number, body: string) {
    super(`[${provider}] HTTP ${status}: ${body.slice(0, 300)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CALIBRATION — the actual fix for "everything scores 68-69"
//
// LLMs are bad at absolute 0-100 scoring with no anchor; they regress to
// the middle of their training distribution regardless of input quality.
// Giving explicit score bands + telling the model NOT to default to the
// middle fixes most of the clustering. This preamble is shared by every
// provider so scores mean the same thing regardless of who answered.
// ─────────────────────────────────────────────────────────────────────────
export const CALIBRATION_PREAMBLE = `
You are scoring YouTube thumbnails for real-world click-through performance.
You have seen millions of real thumbnails and their outcomes during training.
Use that knowledge — don't default to a "safe" middling number.

SCORE CALIBRATION (use this full distribution):
- 90-100: Elite. Large expressive face OR an extremely strong visual hook,
  bold legible text (3-5 words max), high contrast, one unmistakable focal
  point. The kind of thumbnail that drives millions of views.
- 75-89: Strong. Most elements land well, one or two minor weaknesses.
- 55-74: Average. Functional but forgettable — nothing that stops a scroll.
  Most amateur thumbnails belong here, but do not default here out of
  caution. Many thumbnails genuinely deserve below 55 or above 75.
- 35-54: Below average. Missing a clear hook, weak text/face treatment,
  low contrast, or cluttered composition.
- 0-34: Needs work. No clear focal point, illegible text, poor contrast,
  or actively confusing composition.

Rules:
- If a thumbnail has a huge expressive face, bold readable text, and strong
  contrast, you MUST score it 85+. Do not hedge downward "just in case."
- Reserve 55-70 for thumbnails that are genuinely unremarkable, not as a
  default landing zone.
- Briefly reason step by step about what you actually see BEFORE assigning
  any numbers, then make sure the numbers you output match that reasoning.
`.trim();

const RESPONSE_SHAPE = `
Return ONLY valid JSON (no markdown fences, no preamble text) matching exactly:
{
  "overall_score": number,
  "verdict": "needs_work"|"decent"|"good"|"strong"|"excellent",
  "roast_title": string,
  "roast": string,
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": [{"title": string, "description": string, "priority": "high"|"medium"|"low", "category": "visual"|"text"|"emotion"|"composition", "impact": string}],
  "competitor_insights": string[],
  "metrics": {
    "ctr_score": number, "readability_score": number, "emotion_score": number,
    "curiosity_score": number, "mobile_score": number, "contrast_score": number,
    "face_score": number, "brand_score": number, "color_score": number,
    "visual_appeal_score": number
  },
  "niche": string, "thumbnail_style": string, "face_present": boolean,
  "text_present": boolean, "text_count": number, "has_arrow": boolean, "has_circle": boolean
}
`.trim();

function safeParseAnalysis(raw: string, provider: string): ThumbnailAnalysis {
  // Models occasionally wrap JSON in fences even when told not to — strip defensively.
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as ThumbnailAnalysis;
  } catch {
    throw new ProviderError(provider, 502, `Unparseable JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Gemini
// ─────────────────────────────────────────────────────────────────────────
// Flash-Lite has the highest free-tier RPM (15-30 depending on region/date).
// Check https://ai.google.dev/gemini-api/docs/rate-limits for current numbers.
const GEMINI_MODEL = "gemini-flash-lite-latest";

export class OpenRouterAnalyzer implements VisionAnalyzer {
  readonly name = "gemini";

  async analyze(imageUrl: string, apiKey: string): Promise<ThumbnailAnalysis> {
    const prompt = `${CALIBRATION_PREAMBLE}\n\nAnalyze this YouTube thumbnail.\n\n${RESPONSE_SHAPE}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { file_data: { file_uri: imageUrl, mime_type: "image/jpeg" } },
            ],
          }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      },
    );

    if (!res.ok) throw new ProviderError("gemini", res.status, await res.text());

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ProviderError("gemini", 502, "Empty response body");

    return safeParseAnalysis(text, "gemini");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Groq (Llama vision) — separate free quota bucket, absorbs overflow
// ─────────────────────────────────────────────────────────────────────────
const GROQ_MODEL = "llama-3.2-90b-vision-preview";

export class GroqAnalyzer implements VisionAnalyzer {
  readonly name = "groq";

  async analyze(imageUrl: string, apiKey: string): Promise<ThumbnailAnalysis> {
    const prompt = `${CALIBRATION_PREAMBLE}\n\nAnalyze the attached YouTube thumbnail image.\n\n${RESPONSE_SHAPE}`;

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
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
      }),
    });

    if (!res.ok) throw new ProviderError("groq", res.status, await res.text());

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("groq", 502, "Empty response body");

    return safeParseAnalysis(text, "groq");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Resilient wrapper — tries providers in the order given, retries transient
// errors (429 / 5xx) once with backoff, only moves to the next provider
// after that retry also fails or the error is non-transient.
// ─────────────────────────────────────────────────────────────────────────
export interface ProviderConfig {
  analyzer: VisionAnalyzer;
  apiKey: string | undefined;
}

export async function analyzeWithFallback(
  imageUrl: string,
  providers: ProviderConfig[],
): Promise<{ analysis: ThumbnailAnalysis; provider: string }> {
  const errors: string[] = [];

  for (const { analyzer, apiKey } of providers) {
    if (!apiKey) continue; // provider not configured — skip silently

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const analysis = await analyzer.analyze(imageUrl, apiKey);
        return { analysis, provider: analyzer.name };
      } catch (err) {
        const isTransient =
          err instanceof ProviderError && (err.status === 429 || err.status >= 500);
        errors.push(err instanceof Error ? err.message : String(err));

        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
          continue; // one retry on the same provider
        }
        break; // give up on this provider, try the next one
      }
    }
  }

  throw new Error(`All vision providers failed: ${errors.join(" | ")}`);
}