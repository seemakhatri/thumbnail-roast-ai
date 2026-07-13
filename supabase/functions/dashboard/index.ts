import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405, req);
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Authorization header missing", 401, req);
    }

    const jwt = authHeader.substring(7);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(jwt);

    if (authError || !user) {
      return errorResponse("Invalid token", 401, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, analyses_used, analyses_limit")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return errorResponse("Failed to load profile", 500, req);
    }

    const { data: reports, error: reportsError } = await supabase
      .from("reports")
      .select("overall_score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (reportsError) {
      return errorResponse("Failed to load reports", 500, req);
    }

    const totalAnalyses = reports?.length || 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReports =
      reports?.filter((r) => new Date(r.created_at) >= thirtyDaysAgo) || [];

    const avgScore30d =
      recentReports.length > 0
        ? Math.round(
            recentReports.reduce((sum, r) => sum + r.overall_score, 0) /
              recentReports.length,
          )
        : 0;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thirtyDaysAgoPrev = new Date();
    thirtyDaysAgoPrev.setDate(thirtyDaysAgoPrev.getDate() - 30);

    const prevReports =
      reports?.filter(
        (r) =>
          new Date(r.created_at) >= sixtyDaysAgo &&
          new Date(r.created_at) < thirtyDaysAgo,
      ) || [];

    const avgScorePrev =
      prevReports.length > 0
        ? Math.round(
            prevReports.reduce((sum, r) => sum + r.overall_score, 0) /
              prevReports.length,
          )
        : 0;

    // Best score
    const bestScore =
      reports?.length > 0
        ? Math.max(...reports.map((r) => r.overall_score))
        : 0;

    const weakestMetric = null;

    const stats = {
      avg_score_30d: avgScore30d,
      avg_score_prev: avgScorePrev,
      best_score: bestScore,
      total_analyses: totalAnalyses,
      plan: profile?.plan || "free",
      analyses_used: profile?.analyses_used || 0,
      analyses_limit: profile?.analyses_limit || 3,
      weakest_metric: weakestMetric,
    };

    // ── Recent reports ──────────────────────────────────────────────────
    const { data: recent, error: recentError } = await supabase
      .from("reports")
      .select(
        `
        id,
        image_url,
        overall_score,
        verdict,
        roast_title,
        share_slug,
        created_at,
        niche
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentError) {
      return errorResponse("Failed to load recent reports", 500, req);
    }

    // ── Niche benchmarks ──────────────────────────────────────────────────
    const { data: benchmarks, error: benchmarksError } = await supabase
      .from("niche_benchmarks")
      .select("*")
      .limit(20);

    if (benchmarksError) {
      // Don't fail the whole request
    }

    return jsonResponse(
      {
        stats,
        recent: recent || [],
        benchmarks: benchmarks || [],
      },
      200,
      req,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse(
      Deno.env.get("ENV") === "production"
        ? "An internal error occurred"
        : message,
      500,
      req,
    );
  }
});
