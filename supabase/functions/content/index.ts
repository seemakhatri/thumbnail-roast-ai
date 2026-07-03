import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
 
Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
 
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
 
  const url    = new URL(req.url);
  const type   = url.searchParams.get("type");
  const slug   = url.searchParams.get("slug");
  const cat    = url.searchParams.get("category");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "12"), 50);
 
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
 
  try {
    switch (type) {
 
      // ── Blog posts ────────────────────────────────────────────────────
      case "blog": {
        if (slug) {
          const { data, error } = await supabase
            .from("v_blog_posts")
            .select("*")
            .eq("slug", slug)
            .single();
          if (error || !data) return errorResponse("Post not found", 404);
          return jsonResponse({ post: data });
        }
 
        let query = supabase
          .from("v_blog_posts")
          .select("id,title,slug,excerpt,cover_image_url,author_name,category_name,category_slug,read_time_minutes,published_at,featured")
          .order("published_at", { ascending: false })
          .limit(limit);
 
        if (cat) query = query.eq("category_slug", cat);
 
        const { data, error } = await query;
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ posts: data ?? [] });
      }
 
      case "blog-featured": {
        const { data, error } = await supabase
          .from("v_blog_posts")
          .select("id,title,slug,excerpt,cover_image_url,author_name,category_name,read_time_minutes,published_at")
          .eq("featured", true)
          .order("published_at", { ascending: false })
          .limit(3);
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ posts: data ?? [] });
      }
 
      // ── Categories ───────────────────────────────────────────────────
      case "categories": {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true });
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ categories: data ?? [] });
      }
 
      // ── Glossary ─────────────────────────────────────────────────────
      case "glossary": {
        if (slug) {
          const { data, error } = await supabase
            .from("glossary_terms")
            .select("*")
            .eq("slug", slug)
            .single();
          if (error || !data) return errorResponse("Term not found", 404);
          return jsonResponse({ term: data });
        }
        const { data, error } = await supabase
          .from("glossary_terms")
          .select("id,term,slug,definition")
          .order("term", { ascending: true });
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ terms: data ?? [] });
      }
 
      // ── Niches ───────────────────────────────────────────────────────
      case "niches": {
        const { data, error } = await supabase
          .from("niches")
          .select("id,name,slug,description,avg_ctr,avg_score,thumbnail_count")
          .order("name", { ascending: true });
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ niches: data ?? [] });
      }
 
      case "niche": {
        if (!slug) return errorResponse("slug required", 400);
        const { data, error } = await supabase
          .from("niches")
          .select("*")
          .eq("slug", slug)
          .single();
        if (error || !data) return errorResponse("Niche not found", 404);
        return jsonResponse({ niche: data });
      }
 
      default:
        return errorResponse("type param required: blog | glossary | niches | niche | categories", 400);
    }
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Server error", 500);
  }
});
