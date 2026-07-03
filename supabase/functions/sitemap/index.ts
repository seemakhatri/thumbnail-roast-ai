import { createClient } from "../_shared/deps.ts";

const BASE = "https://localhost:4200";

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const [posts, glossary, niches, comparisons, research] = await Promise.all([
    supabase.from("blog_posts").select("slug,updated_at").eq("status", "published"),
    supabase.from("glossary_terms").select("slug,updated_at"),
    supabase.from("niches").select("slug,updated_at"),
    supabase.from("comparisons").select("slug,updated_at").eq("status", "published"),
    supabase.from("research_articles").select("slug,published_at").eq("status", "published"),
  ]);

  const staticUrls = [
    { url: "/",         changefreq: "daily",   priority: "1.0" },
    { url: "/analyze",  changefreq: "monthly", priority: "0.9" },
    { url: "/pricing",  changefreq: "monthly", priority: "0.8" },
    { url: "/blog",     changefreq: "daily",   priority: "0.8" },
    { url: "/glossary", changefreq: "weekly",  priority: "0.7" },
    { url: "/tools",    changefreq: "monthly", priority: "0.7" },
    { url: "/niche",    changefreq: "weekly",  priority: "0.7" },
    { url: "/research", changefreq: "weekly",  priority: "0.7" },
    { url: "/compare",  changefreq: "monthly", priority: "0.6" },
    { url: "/tools/ctr-calculator",   changefreq: "monthly", priority: "0.7" },
    { url: "/tools/contrast-checker", changefreq: "monthly", priority: "0.7" },
    { url: "/tools/mobile-preview",   changefreq: "monthly", priority: "0.7" },
  ];

  const entry = (url: string, lastmod?: string, changefreq = "weekly", priority = "0.6") => `
  <url>
    <loc>${BASE}${url}</loc>
    ${lastmod ? `<lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

  const allUrls = [
    ...staticUrls.map(u => entry(u.url, undefined, u.changefreq, u.priority)),
    ...(posts.data ?? []).map(p  => entry(`/blog/${p.slug}`,       p.updated_at,   "weekly",  "0.6")),
    ...(glossary.data ?? []).map(g => entry(`/glossary/${g.slug}`, g.updated_at,   "monthly", "0.5")),
    ...(niches.data ?? []).map(n  => entry(`/niche/${n.slug}`,     n.updated_at,   "weekly",  "0.65")),
    ...(comparisons.data ?? []).map(c => entry(`/compare/${c.slug}`, c.updated_at, "monthly", "0.6")),
    ...(research.data ?? []).map(r => entry(`/research/${r.slug}`, r.published_at, "monthly", "0.7")),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});