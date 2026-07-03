import { createClient } from "../_shared/deps.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Authorization header missing", 401);
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
      return errorResponse("Invalid token", 401);
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

    // Dashboard statistics
    const { data: stats, error: statsError } =
      await supabase.rpc("get_dashboard_stats", {
        p_user_id: user.id,
      });

    if (statsError) {
      console.error("Dashboard RPC Error:", statsError);

      return errorResponse(statsError.message, 500);
    }

    // Recent reports
    const { data: recent, error: reportsError } = await supabase
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

    if (reportsError) {
      console.error("Recent reports error:", reportsError);

      return errorResponse(reportsError.message, 500);
    }

    return jsonResponse({
      stats,
      recent: recent ?? [],
    });
  } catch (err) {
    console.error(err);

    return errorResponse(
      err instanceof Error ? err.message : "Unexpected server error",
      500,
    );
  }
});