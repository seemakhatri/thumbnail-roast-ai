import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { Stripe } from "../_shared/deps.ts";

// Initialize Stripe with your secret key
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// Plan limits mapping - keep in sync with webhook
const PLAN_LIMITS: Record<string, number> = {
    free: 3,
    creator: 50,
    business: 200,
    agency: 500
};

// Plan price IDs - keep in sync with Stripe dashboard
const PLAN_PRICE_IDS: Record<string, string | undefined> = {
    creator: Deno.env.get("STRIPE_CREATOR_PRICE_ID"),
    business: Deno.env.get("STRIPE_BUSINESS_PRICE_ID"),
    agency: Deno.env.get("STRIPE_AGENCY_PRICE_ID"),
};

Deno.serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    if (req.method !== "POST") {
        return errorResponse("Method not allowed", 405);
    }

    try {
        const body = await req.json();
        const { plan, userId } = body;

        console.log("Create Checkout Request:", { plan, userId });

        if (!plan || !userId) {
            return errorResponse("plan and userId are required", 400);
        }

        // Get the correct price ID for this plan
        const priceId = PLAN_PRICE_IDS[plan as string];
        
        if (!priceId) {
            return errorResponse(`Stripe price ID not configured for plan: ${plan}`, 500);
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

        return jsonResponse({ url: session.url });
    } catch (error: unknown) {
        console.error("CREATE CHECKOUT ERROR:", error);
        return errorResponse(
            error instanceof Error ? error.message : String(error),
            500,
        );
    }
});