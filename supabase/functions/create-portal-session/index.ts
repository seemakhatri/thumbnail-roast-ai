import { createClient } from "../_shared/deps.ts";
import { Stripe } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("create-portal-session");

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Authentication required", 401);
    }

    const jwt = authHeader.slice(7);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return errorResponse("Invalid token", 401);
    }

    // ── Get the user's Stripe customer ID ────────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return errorResponse("No active subscription found", 404);
    }

    // ── Create Stripe Customer Portal session ────────────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const frontendOrigin = Deno.env.get("FRONTEND_ORIGIN") ?? "http://localhost:4200";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${frontendOrigin}/dashboard`,
      // Optional: you can pre‑select the "cancel" or "change" flow
      // flow_data: { type: "subscription_update", ... }
    });

    logger.info("Portal session created", { userId: user.id, sessionId: session.id });

    return jsonResponse({ url: session.url }, 200, req);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    logger.error("Portal session error", { error: message });
    return errorResponse(
      Deno.env.get("ENV") === "production" ? "Unable to create session" : message,
      500
    );
  }
});