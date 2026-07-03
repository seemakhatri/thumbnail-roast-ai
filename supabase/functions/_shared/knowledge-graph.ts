// _shared/knowledge-graph.ts
//
// Generated from thumbnail-knowledge-graph.json -- the sourced knowledge base
// (verified YouTube Help/Blog facts, general psychology principles, niche
// rules, and things the analyzer should never assume). Imported directly
// into gemini.ts prompt-building so the model reasoning stays anchored
// to real sources instead of drifting back toward generic advice over time.

export const KNOWLEDGE_GRAPH = {
  "meta": {
    "purpose": "Grounding knowledge base for Thumbnail Roast AI's analysis engine. Every rule is tagged with a source_type so the analyzer (and you) can tell verified YouTube documentation apart from general psychology research and industry consensus. Nothing here includes invented statistics.",
    "source_types": {
      "youtube_primary": "YouTube's own Help Center or official Blog \u2014 the only fully verifiable source class",
      "general_psychology": "Established, broadly-replicated research on attention/perception/cognition \u2014 NOT YouTube-specific, applied by inference",
      "industry_consensus": "Widely repeated among experienced creators but not independently verifiable \u2014 treat as a hypothesis to test on your own data, not a fact",
      "unverifiable_excluded": "Numbers commonly cited online (e.g. 'faces increase CTR 20-30%') that trace back to uncited marketing blogs, not YouTube or research. Deliberately excluded from this graph \u2014 flagged here so nobody re-adds them later."
    },
    "excluded_claims": [
      "Faces increase CTR by 20-30% (VidIQ-attributed, no verifiable original study)",
      "Optimized metadata gets 3x / 30% more impressions (uncited 'YouTube Creator Academy 2025' claim not found on any official page)",
      "Consistent branding increases retention by 15% (uncited blog claim)",
      "Any specific eye-tracking heatmap percentages for YouTube thumbnails specifically (no public YouTube-specific eye-tracking study exists as of this build)"
    ]
  },
  "verified_youtube_facts": [
    {
      "id": "yt-001",
      "fact": "90% of the best-performing videos on YouTube have custom thumbnails.",
      "source": "YouTube Help \u2014 Thumbnail & title tips",
      "url": "https://support.google.com/youtube/answer/12340300",
      "confidence": "high"
    },
    {
      "id": "yt-002",
      "fact": "For general audiences, thumbnail/title effectiveness should be measured via CTR on Home and Suggested in the first 24 hours after publication, filtered to videos with above-average impressions. For subscribers, measure CTR in the Subscriptions Feed in the first 24 hours.",
      "source": "YouTube Help \u2014 Thumbnail & title tips",
      "url": "https://support.google.com/youtube/answer/12340300",
      "confidence": "high"
    },
    {
      "id": "yt-003",
      "fact": "Content targeting existing subscribers can use familiar, in-joke elements; content targeting casual/new viewers should favor universally relatable emotion (their own example: a shocked face) since it doesn't rely on shared context.",
      "source": "YouTube Help \u2014 Thumbnail & title tips",
      "url": "https://support.google.com/youtube/answer/12340300",
      "confidence": "high"
    },
    {
      "id": "yt-004",
      "fact": "Dynamic use of color and composition helps catch the eye, but too much overwhelms it. Rule of thirds is recommended for composition. Text overlays should use a legible font and avoid over-complication.",
      "source": "YouTube Help \u2014 Thumbnail & title tips",
      "url": "https://support.google.com/youtube/answer/12340300",
      "confidence": "high"
    },
    {
      "id": "yt-005",
      "fact": "Half of all channels/videos on YouTube have an impressions-CTR between roughly 2% and 10%. New videos/channels or videos with fewer than 100 views can see a much wider range.",
      "source": "YouTube Help \u2014 Impressions & CTR FAQs",
      "confidence": "high"
    },
    {
      "id": "yt-006",
      "fact": "A thumbnail/title combination showing signs of clickbait is diagnosed by: high CTR + low average view duration + impressions lower than expected. High CTR alone is not evidence of a good thumbnail \u2014 it must be read alongside retention.",
      "source": "YouTube Help \u2014 Impressions & CTR FAQs",
      "confidence": "high"
    },
    {
      "id": "yt-007",
      "fact": "Testing multiple thumbnails or titles on the same video makes CTR differences hard to interpret, because it's difficult to guarantee each version was shown to a comparable audience \u2014 differences may reflect traffic source mix, not creative quality.",
      "source": "YouTube Help \u2014 Impressions & CTR FAQs",
      "confidence": "high"
    },
    {
      "id": "yt-008",
      "fact": "It's recommended to wait for a substantial number of impressions before judging CTR, and to avoid reacting to small, statistically insignificant CTR fluctuations.",
      "source": "YouTube Help \u2014 Impressions & CTR FAQs",
      "confidence": "high"
    },
    {
      "id": "yt-009",
      "fact": "YouTube measures 'valued watchtime' via post-view 1-5 star surveys; only videos rated 4-5 stars count toward valued watchtime. Raw watch time alone was found insufficient \u2014 a purely watch-time-optimized system can surface content people regret spending time on.",
      "source": "YouTube Blog \u2014 On YouTube's recommendation system",
      "url": "https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/",
      "confidence": "high"
    },
    {
      "id": "yt-010",
      "fact": "Recommendation signals include: watch history (what's watched, ignored, or marked 'not interested'), survey responses, likes/shares/comments, subscribed channels, and how much of a video is watched. 'Not interested' and 'Don't recommend channel' selections actively suppress future recommendations from that source.",
      "source": "YouTube Help \u2014 How YouTube recommendations work / YouTube's Recommendation System",
      "confidence": "high"
    },
    {
      "id": "yt-011",
      "fact": "Changing a title or thumbnail can shift a video's performance, but the system responds to how viewers newly interact with the changed presentation \u2014 not to the act of changing it. YouTube advises against changing what's already working; changes are recommended mainly when CTR and impressions are already lower than usual.",
      "source": "YouTube Help \u2014 Good to know about recommendations",
      "confidence": "high"
    },
    {
      "id": "yt-012",
      "fact": "Even with strong CTR and average view duration, impressions can still be limited by competition \u2014 if other videos targeting the same audience perform even better, a video may not reach as many viewers regardless of its own quality.",
      "source": "YouTube Help \u2014 Good to know about recommendations",
      "confidence": "high"
    },
    {
      "id": "yt-013",
      "fact": "It's recommended to periodically revisit and refresh a channel's thumbnail style over time, since audience taste and what works shifts \u2014 but not to abandon a demonstrably working thumbnail/title without reason (see yt-011).",
      "source": "YouTube Help \u2014 Thumbnail & title tips",
      "confidence": "high"
    }
  ],
  "general_psychology_principles": [
    {
      "id": "psych-001",
      "principle": "Faces (and especially eyes/emotional expressions) are processed by dedicated, fast visual-attention pathways in the human brain, making them reliably fast to detect in a scene compared to non-face objects.",
      "applies_to_thumbnails_as": "A face, where relevant to the content and audience, is a fast, low-effort attention anchor \u2014 not a universal requirement.",
      "source_type": "general_psychology",
      "confidence": "medium \u2014 well-established in vision science generally; the magnitude of its effect on YouTube CTR specifically is not independently measured by any public study"
    },
    {
      "id": "psych-002",
      "principle": "Visual search and scene-processing research shows viewers extract gist/layout information from an image extremely quickly (often described as near-instantaneous, sub-second), before detailed, deliberate inspection occurs.",
      "applies_to_thumbnails_as": "A thumbnail's dominant subject and overall composition need to communicate the core idea before a viewer would consciously study it \u2014 supports 'one dominant focal point' design advice.",
      "source_type": "general_psychology",
      "confidence": "medium \u2014 general finding in cognitive psychology; not a YouTube-specific measurement"
    },
    {
      "id": "psych-003",
      "principle": "The 'curiosity gap' (information-gap theory) \u2014 people are motivated to resolve gaps between what they know and what they want to know \u2014 is a well-studied driver of information-seeking behavior.",
      "applies_to_thumbnails_as": "A thumbnail that clearly implies a specific unanswered question (not vague mystery) can motivate a click. Over-withholding information, or implying a gap the video doesn't resolve, damages trust and retention (this is the psychological mechanism behind yt-006's clickbait diagnosis).",
      "source_type": "general_psychology",
      "confidence": "medium \u2014 well-supported general theory; specific application strength varies by topic and audience, not independently quantified for YouTube"
    },
    {
      "id": "psych-004",
      "principle": "Higher color contrast and luminance differences between a subject and its background make that subject easier and faster to visually segment from its surroundings (basic figure-ground perception).",
      "applies_to_thumbnails_as": "High contrast between subject and background supports faster recognition in a scroll/grid context, particularly at small mobile sizes.",
      "source_type": "general_psychology",
      "confidence": "medium-high \u2014 long-established finding in visual perception"
    },
    {
      "id": "psych-005",
      "principle": "Working memory and attention have limited capacity; scenes with more distinct elements competing for attention take longer to process and are more likely to be abandoned under time pressure (cognitive load theory).",
      "applies_to_thumbnails_as": "A cluttered thumbnail with many competing elements is harder to parse in the fraction of a second a scrolling viewer allots it, independent of how attractive each individual element is.",
      "source_type": "general_psychology",
      "confidence": "medium-high"
    }
  ],
  "niche_specific_rules": [
    {
      "niche": "art_creative",
      "primary_anchor": "the artwork/subject itself, not necessarily a face",
      "face_requirement": "optional \u2014 evidence within this project: a faceless art thumbnail (0 face score) scored well and matched strong real-world performance once face weight was reduced for this niche",
      "notes": "Composition, color vibrancy, and visual craftsmanship of the piece function as the primary hook. A hand-in-frame or process shot can add authenticity without requiring a visible face.",
      "confidence": "industry_consensus \u2014 matches YouTube's own general audience-targeting guidance (yt-003) but is not a YouTube-published niche-specific rule"
    },
    {
      "niche": "gaming",
      "primary_anchor": "gameplay moment, character, or reaction face",
      "face_requirement": "commonly used but not YouTube-verified as required",
      "notes": "Text hooks and high-saturation, high-contrast treatments are common in this niche's visual conventions.",
      "confidence": "industry_consensus"
    },
    {
      "niche": "finance_business",
      "primary_anchor": "text/number-driven claim",
      "face_requirement": "adds perceived authority/credibility but is secondary to a clear, specific text claim",
      "notes": "Vague claims are harder to distinguish from clickbait under yt-006's diagnostic (high CTR, low retention) if the video can't deliver on a specific promise.",
      "confidence": "industry_consensus"
    },
    {
      "niche": "food_cooking",
      "primary_anchor": "the food itself",
      "face_requirement": "optional \u2014 food presentation and color vibrancy typically carry more weight",
      "confidence": "industry_consensus"
    },
    {
      "niche": "education_tutorial",
      "primary_anchor": "a clear, specific promise of outcome or knowledge",
      "face_requirement": "adds approachability but a specific curiosity-gap or promise (psych-003) is treated as more important",
      "confidence": "industry_consensus"
    }
  ],
  "signals_the_analyzer_should_check": [
    "Detected niche/content category (drives which weighting profile applies)",
    "Dominant visual subject / focal point and whether there is exactly one clear one",
    "Text presence, word count, and legibility at small/mobile scale",
    "Contrast between subject and background",
    "Whether a face is present AND whether this niche treats face as load-bearing",
    "Whether the thumbnail implies a specific curiosity gap vs. a vague one",
    "Whether visible claims in text/imagery appear deliverable by a video (clickbait risk proxy \u2014 analyzer can't see the video, so this should be phrased as a risk flag, not a certainty)",
    "Consistency with prior thumbnails from the same channel, if available (branding signal)"
  ],
  "signals_the_analyzer_should_never_assume": [
    "That the absence of a face is a defect \u2014 must be evaluated per detected niche (see niche_specific_rules)",
    "That a specific numeric CTR uplift results from any single design choice \u2014 no verifiable per-element CTR-lift statistic exists; the analyzer should describe direction/rationale, not invent a percentage",
    "That a thumbnail scoring well predicts virality \u2014 YouTube's own documentation (yt-012) states impressions are also gated by competition from other videos, which the analyzer has no visibility into",
    "That a high predicted score guarantees retention \u2014 CTR and satisfaction are separate signals per yt-009/yt-010; a thumbnail can be excellent at generating clicks and still belong to a video that under-delivers",
    "That one static ruleset should apply to test-and-compare results \u2014 if a user has actual A/B data from YouTube, that real data should override the model's prediction, not the other way around"
  ],
  "confidence_scale_definition": {
    "high": "Directly stated in YouTube's own Help Center or official Blog",
    "medium_high": "Well-established general psychology/perception research with strong disciplinary consensus",
    "medium": "Reasonable inference connecting general research to the thumbnail context, or a widely-repeated creator heuristic with plausible mechanism",
    "industry_consensus_low": "Repeated frequently among creators/marketers but not independently verifiable \u2014 should be treated as a testable hypothesis within your own product (e.g. against a user's connected YouTube CTR data), not asserted as fact to users"
  },
  "contradictory_or_context_dependent_cases": [
    {
      "case": "Face presence and CTR",
      "conflict": "Widely repeated claim that faces universally raise CTR vs. observed high performance from consistently faceless top channels (e.g. commentary/explainer channels using objects, data visuals, or artwork as the anchor) and this project's own faceless-thumbnail test",
      "resolution_used": "Treat face as one possible attention anchor among several (object, artwork, text, scene), weighted per detected niche rather than treated as universally required or universally optional",
      "confidence": "industry_consensus, but internally consistent with YouTube's own framing of audience-appropriate emotional cues (yt-003) rather than a face mandate"
    },
    {
      "case": "High CTR as a success signal",
      "conflict": "High CTR is often treated by creators as the primary success metric, but YouTube explicitly treats high-CTR-with-low-retention as a clickbait warning sign, not a win",
      "resolution_used": "Never score or praise CTR-driving elements in isolation from an implied retention/deliverability check; frame curiosity-gap recommendations with an explicit 'must be resolvable by the actual video' caveat",
      "confidence": "high (yt-006, yt-009)"
    }
  ]
} as const;