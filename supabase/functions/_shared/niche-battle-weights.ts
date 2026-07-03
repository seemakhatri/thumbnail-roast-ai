// _shared/niche-battle-weights.ts
//
// The weighting brain behind Compare. Two jobs:
//
// 1. NICHE WEIGHTS — how much each of the 8 comparison factors matters
//    for a given content niche. A gaming thumbnail lives and dies on
//    face expressiveness; a food thumbnail lives and dies on color and
//    composition. Using one flat weighting for every niche is exactly
//    the bug that used to cap faceless-but-strong thumbnails artificially
//    low in the single-image analyzer — we don't repeat it here.
//
// 2. PLACEMENT MULTIPLIERS — the same two thumbnails can have different
//    winners depending on where they're shown. A YouTube thumbnail is
//    rendered at roughly:
//      - ~1280x720 in the uploader/editor
//      - ~336x188  in the mobile home feed
//      - ~120x67   in the "up next" / suggested sidebar
//      - larger again in desktop search results, competing against text
//    At sidebar size, fine detail and small text disappear; only bold
//    contrast and a legible face/shape survive. This is standard YouTube
//    creator knowledge, and it's the reason two "equally good" thumbnails
//    can have a clear practical winner depending on where the video is
//    actually going to be watched.

export interface FactorWeights {
  face: number;
  text: number;
  contrast: number;
  color: number;
  composition: number;
  emotion: number;
  curiosity: number;
  brand: number;
}

export const FACTOR_KEYS: (keyof FactorWeights)[] = [
  "face", "text", "contrast", "color", "composition", "emotion", "curiosity", "brand",
];

export const FACTOR_LABELS: Record<keyof FactorWeights, string> = {
  face: "Face Prominence & Expression",
  text: "Text Legibility",
  contrast: "Contrast",
  color: "Color & Palette",
  composition: "Composition & Focal Point",
  emotion: "Emotional Hook",
  curiosity: "Curiosity Gap",
  brand: "Brand Consistency",
};

// Maps a comparison factor to the equivalent field already stored on a
// `reports` row, so we can blend fresh judgment with calibrated history.
export const FACTOR_TO_STORED_METRIC: Record<keyof FactorWeights, string> = {
  face: "face_score",
  text: "readability_score",
  contrast: "contrast_score",
  color: "color_score",
  composition: "visual_appeal_score",
  emotion: "emotion_score",
  curiosity: "curiosity_score",
  brand: "brand_score",
};

type Niche =
  | "gaming" | "finance" | "food" | "tech" | "fitness" | "beauty"
  | "education" | "music" | "art" | "sports" | "travel" | "vlog"
  | "comedy" | "news" | "diy" | "general";

const DEFAULT: FactorWeights = {
  face: 0.16, text: 0.14, contrast: 0.12, color: 0.10,
  composition: 0.14, emotion: 0.14, curiosity: 0.14, brand: 0.06,
};

export const NICHE_BATTLE_WEIGHTS: Record<Niche, FactorWeights> = {
  gaming:    { face: 0.20, text: 0.12, contrast: 0.14, color: 0.14, composition: 0.10, emotion: 0.12, curiosity: 0.12, brand: 0.06 },
  finance:   { face: 0.12, text: 0.20, contrast: 0.12, color: 0.08, composition: 0.12, emotion: 0.10, curiosity: 0.18, brand: 0.08 },
  food:      { face: 0.06, text: 0.10, contrast: 0.10, color: 0.22, composition: 0.20, emotion: 0.10, curiosity: 0.14, brand: 0.08 },
  tech:      { face: 0.10, text: 0.18, contrast: 0.14, color: 0.10, composition: 0.14, emotion: 0.08, curiosity: 0.18, brand: 0.08 },
  fitness:   { face: 0.20, text: 0.10, contrast: 0.12, color: 0.10, composition: 0.12, emotion: 0.16, curiosity: 0.12, brand: 0.08 },
  beauty:    { face: 0.22, text: 0.08, contrast: 0.10, color: 0.16, composition: 0.14, emotion: 0.12, curiosity: 0.10, brand: 0.08 },
  education: { face: 0.10, text: 0.20, contrast: 0.12, color: 0.08, composition: 0.14, emotion: 0.08, curiosity: 0.20, brand: 0.08 },
  music:     { face: 0.16, text: 0.08, contrast: 0.12, color: 0.18, composition: 0.16, emotion: 0.16, curiosity: 0.08, brand: 0.06 },
  art:       { face: 0.05, text: 0.07, contrast: 0.10, color: 0.24, composition: 0.24, emotion: 0.10, curiosity: 0.12, brand: 0.08 },
  sports:    { face: 0.18, text: 0.10, contrast: 0.14, color: 0.10, composition: 0.14, emotion: 0.16, curiosity: 0.12, brand: 0.06 },
  travel:    { face: 0.08, text: 0.08, contrast: 0.10, color: 0.20, composition: 0.22, emotion: 0.12, curiosity: 0.14, brand: 0.06 },
  vlog:      { face: 0.20, text: 0.08, contrast: 0.10, color: 0.10, composition: 0.12, emotion: 0.20, curiosity: 0.14, brand: 0.06 },
  comedy:    { face: 0.22, text: 0.08, contrast: 0.10, color: 0.10, composition: 0.10, emotion: 0.22, curiosity: 0.12, brand: 0.06 },
  news:      { face: 0.12, text: 0.18, contrast: 0.14, color: 0.06, composition: 0.12, emotion: 0.10, curiosity: 0.20, brand: 0.08 },
  diy:       { face: 0.08, text: 0.14, contrast: 0.12, color: 0.14, composition: 0.20, emotion: 0.10, curiosity: 0.16, brand: 0.06 },
  general:   DEFAULT,
};

export function weightsForNiche(niche?: string | null): FactorWeights {
  const key = (niche?.toLowerCase().trim() ?? "general") as Niche;
  return NICHE_BATTLE_WEIGHTS[key] ?? DEFAULT;
}

// ─────────────────────────────────────────────────────────────────────────
// Placement contexts
// ─────────────────────────────────────────────────────────────────────────
export type PlacementContext =
  | "mobile_feed" | "suggested_sidebar" | "search_results" | "desktop_home";

export const PLACEMENT_CONTEXTS: { id: PlacementContext; label: string; blurb: string }[] = [
  { id: "mobile_feed", label: "Mobile Feed", blurb: "~336×188, thumb-scroll speed" },
  { id: "suggested_sidebar", label: "Suggested / Up Next", blurb: "~120×67, glanced for under a second" },
  { id: "search_results", label: "Search Results", blurb: "competing directly against a bold title" },
  { id: "desktop_home", label: "Desktop Home", blurb: "full detail visible, most forgiving surface" },
];

const PLACEMENT_MULTIPLIERS: Record<PlacementContext, Partial<FactorWeights>> = {
  // Small screen, fast thumb-scroll — bold contrast and a readable face
  // are what stop the scroll; fine text and subtle composition vanish.
  mobile_feed: { contrast: 1.4, face: 1.3, text: 0.7, composition: 0.9 },
  // Rendered at ~120x67px next to the video being watched — only the
  // boldest, highest-contrast elements survive at that size at all.
  suggested_sidebar: { contrast: 1.6, face: 1.4, text: 0.5, color: 0.8, composition: 0.7 },
  // Sits beside a bold blue title link — the thumbnail has to win on
  // curiosity/emotion since text on the image competes with the title.
  search_results: { text: 1.3, curiosity: 1.2, contrast: 1.1, emotion: 1.05 },
  // Full detail visible — composition and color nuance actually register.
  desktop_home: { composition: 1.2, color: 1.15, emotion: 1.1 },
};

/** Returns a normalized (sums to 1) weight set adjusted for a placement context. */
export function applyPlacement(base: FactorWeights, context: PlacementContext): FactorWeights {
  const mult = PLACEMENT_MULTIPLIERS[context];
  const adjusted: FactorWeights = { ...base };
  for (const key of FACTOR_KEYS) {
    adjusted[key] = base[key] * (mult[key] ?? 1);
  }
  const total = FACTOR_KEYS.reduce((sum, k) => sum + adjusted[k], 0);
  for (const key of FACTOR_KEYS) {
    adjusted[key] = adjusted[key] / total;
  }
  return adjusted;
}