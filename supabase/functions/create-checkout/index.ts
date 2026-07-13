import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { Stripe, createClient } from "../_shared/deps.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  creator: 50,
  business: 200,
  agency: 500,
};

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  creator: Deno.env.get("STRIPE_CREATOR_PRICE_ID"),
  business: Deno.env.get("STRIPE_BUSINESS_PRICE_ID"),
  agency: Deno.env.get("STRIPE_AGENCY_PRICE_ID"),
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Authentication required", 401, req);
    }

    const jwt = authHeader.slice(7);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return errorResponse("Invalid authentication token", 401, req);
    }

    const { plan } = await req.json();

    if (!plan) {
      return errorResponse("plan is required", 400, req);
    }

    const userId = user.id;

    console.log("Create Checkout Request:", {
      plan,
      userId,
    });

    // Get the correct price ID for this plan
    const priceId = PLAN_PRICE_IDS[plan as string];

    if (!priceId) {
      return errorResponse(
        `Stripe price ID not configured for plan: ${plan}`,
        500,
        req,
      );
    }

    const origin = Deno.env.get("FRONTEND_ORIGIN") ?? "http://localhost:4200";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      metadata: {
        userId: userId,
        plan: plan,
        plan_limit: String(PLAN_LIMITS[plan] || 3),
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    });

    console.log("Checkout session created:", session.id);

    return jsonResponse({ url: session.url }, 200, req);
  } catch (error: unknown) {
    console.error("CREATE CHECKOUT ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      500,
      req,
    );
  }
});
