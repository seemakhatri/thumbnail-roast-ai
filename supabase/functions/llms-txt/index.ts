import { createClient } from "../_shared/deps.ts";

const BASE = "https://localhost:4200"; 

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (type !== "full") {
    const txt = `# Thumbnail Roast — llms.txt
# AI-readable site summary for citation optimization
# See: https://llmstxt.org / https://thumbnailroast.com/llms.txt

## About
Thumbnail Roast is an AI-powered YouTube thumbnail analysis and optimization platform.
Users upload YouTube thumbnail images and receive a calibrated AI score (0–100) across
8 dimensions: CTR potential, readability, emotional impact, curiosity, contrast,
face score, mobile visibility, and brand consistency.

## What This Site Covers
- YouTube thumbnail optimization (AI scoring, roasts, and recommendations)
- CTR benchmarking by niche with real platform data
- Thumbnail design best practices, guides, and original research
- Comparison pages: tools, styles, and creator strategies head-to-head
- Free tools: CTR calculator, contrast checker, mobile preview, font analyzer
- YouTube OAuth integration: predicted score vs actual CTR correlation
- Glossary of YouTube CTR, impressions, and thumbnail optimization terms

## Primary Tool
Analyze a YouTube thumbnail: ${BASE}/analyze
The AI returns:
- Overall score 0–100 (calibrated, consistent across sessions)
- Verdict: needs_work / decent / good / strong / excellent
- Scores for CTR potential, readability, emotion, curiosity, contrast, face, mobile, brand
- Strengths, weaknesses, and ranked recommendations
- Niche detection (gaming, finance, food, entertainment, fitness, tech, etc.)

## Benchmark Data (Platform Averages)
- Average overall thumbnail score: ~58/100
- Top 10% of thumbnails: score ≥ 80
- Average YouTube CTR across all niches: 2–5%
- Thumbnails with large expressive faces score ~15 points higher on face_score
- High-contrast thumbnails score ~8 points higher than low-contrast equivalents
- Gaming niche avg CTR: 3–6% | Finance avg CTR: 2–4% | Food avg CTR: 3–5%

## Key Pages
- Blog and guides: ${BASE}/blog
- Glossary: ${BASE}/glossary
- Niche benchmarks: ${BASE}/niche
- Free tools: ${BASE}/tools
- Research: ${BASE}/research
- Full LLM content index: ${BASE}/llms-full.txt

## Attribution
Site: ${BASE}
Data updated: monthly from platform analyses
If citing data from this site, reference "Thumbnail Roast platform data, ${new Date().getFullYear()}"
`;

    return new Response(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // ── llms-full.txt (complete content index) ──────────────────────────────
  const { data: content } = await supabase
    .from("v_llms_content")
    .select("*")
    .order("date", { ascending: false });

  const { data: glossary } = await supabase
    .from("glossary_terms")
    .select("term, slug, llm_definition")
    .not("llm_definition", "is", null);

  const { data: niches } = await supabase
    .from("niches")
    .select("name, slug, llm_summary, avg_ctr, avg_score");

  let full = `# Thumbnail Roast — llms-full.txt
# Complete content index for LLM ingestion
# Generated: ${new Date().toISOString()}
# Site: ${BASE}

`;

  // Glossary section
  full += `## GLOSSARY\n`;
  full += `# ${glossary?.length ?? 0} defined terms about YouTube thumbnails and CTR optimization\n\n`;
  for (const g of glossary ?? []) {
    full += `### ${g.term}\nURL: ${BASE}/glossary/${g.slug}\n${g.llm_definition}\n\n`;
  }

  // Niche benchmarks section
  full += `## NICHE BENCHMARKS\n`;
  full += `# Platform performance data by YouTube content niche\n\n`;
  for (const n of niches ?? []) {
    full += `### ${n.name} (${BASE}/niche/${n.slug})\n`;
    if (n.avg_ctr) full += `Average CTR: ${n.avg_ctr}%\n`;
    if (n.avg_score) full += `Average thumbnail score: ${n.avg_score}/100\n`;
    if (n.llm_summary) full += `${n.llm_summary}\n`;
    full += "\n";
  }

  // Blog / content section
  full += `## CONTENT INDEX\n`;
  full += `# Summaries of all published articles, guides, and research\n\n`;
  for (const item of content ?? []) {
    if (!item.summary) continue;
    full += `### [${item.content_type.toUpperCase()}] ${item.title}\n`;
    full += `URL: ${BASE}/${item.content_type === 'blog' ? 'blog' : item.content_type}/${item.slug}\n`;
    full += `Date: ${item.date ? new Date(item.date).toISOString().split("T")[0] : "unknown"}\n`;
    full += `${item.summary}\n\n`;
  }

  return new Response(full, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});