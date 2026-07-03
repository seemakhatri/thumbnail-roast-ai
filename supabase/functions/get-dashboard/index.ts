import { Stripe } from "../_shared/deps.ts";

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Helper functions
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    });
}

function errorResponse(message: string, status = 500): Response {
    return jsonResponse({ error: message }, status);
}

// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

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

        const priceId = plan === "agency"
            ? Deno.env.get("STRIPE_AGENCY_PRICE_ID")
            : Deno.env.get("STRIPE_CREATOR_PRICE_ID");

        console.log("Selected Price ID:", priceId);

        if (!priceId) {
            return errorResponse("Stripe price ID not configured", 500);
        }

        const origin = Deno.env.get("FRONTEND_ORIGIN") ?? "http://localhost:4200";

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            client_reference_id: userId,
            metadata: {
                userId: userId,
                plan: plan,
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