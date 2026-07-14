import { Stripe } from "../_shared/deps.ts";
import { createClient } from "../_shared/deps.ts";

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ── PLAN LIMITS ─────────────────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, number> = {
    free: 3,
    creator: 50,
    business: 200,
    agency: 500
};

// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// Initialize Supabase
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.text();
        const signature = req.headers.get("stripe-signature");

        if (!signature) {
            return new Response("Missing stripe-signature header", { status: 400 });
        }

        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
        if (!webhookSecret) {
            return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
        }

        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
        );

        console.log("Webhook Event:", event.type);

        // ── Idempotency ──────────────────────────────────────────────────────
        const { data: alreadyProcessed } = await supabase
            .from("processed_webhook_events")
            .select("stripe_event_id")
            .eq("stripe_event_id", event.id)
            .maybeSingle();

        if (alreadyProcessed) {
            console.log("Duplicate webhook event, skipping:", event.id);
            return new Response(JSON.stringify({ success: true, note: "already processed" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        await supabase
            .from("processed_webhook_events")
            .insert({ stripe_event_id: event.id });

        // ── Handle Events ────────────────────────────────────────────────────

        // 1. Checkout Completed
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;
            const plan = session.metadata?.plan;

            if (!userId) {
                console.error("Missing userId in metadata");
                return new Response("Missing userId", { status: 400 });
            }

            const analysesLimit = PLAN_LIMITS[plan as string] || 3;

            const { data, error } = await supabase
                .from("profiles")
                .update({
                    plan: plan,
                    analyses_limit: analysesLimit,
                    analyses_used: 0,
                    stripe_customer_id: session.customer ? String(session.customer) : null,
                    stripe_subscription_id: session.subscription ? String(session.subscription) : null,
                    subscription_status: "active",
                })
                .eq("id", userId)
                .select();

            if (error) {
                console.error("Profile update error:", error);
                throw error;
            }

        }

        // 2. Subscription Canceled
        if (event.type === "customer.subscription.deleted") {
            const subscription = event.data.object as Stripe.Subscription;

            const { data, error } = await supabase
                .from("profiles")
                .update({
                    plan: "free",
                    analyses_limit: 3,
                    analyses_used: 0,
                    subscription_status: "cancelled",
                    stripe_subscription_id: null,
                })
                .eq("stripe_subscription_id", subscription.id)
                .select();

            if (error) {
                console.error("Cancel update error:", error);
                throw error;
            }
        }

        // 3. Subscription Updated
        if (event.type === "customer.subscription.updated") {
            const subscription = event.data.object as Stripe.Subscription;
            
            const newPlan = subscription.metadata?.plan;
            const currentStatus = subscription.status === 'active' ? 'active' : 'cancelled';
            
            if (newPlan && PLAN_LIMITS[newPlan]) {
                const { data: userProfile } = await supabase
                    .from("profiles")
                    .select("plan")
                    .eq("stripe_subscription_id", subscription.id)
                    .single();

                if (userProfile && userProfile.plan !== newPlan) {
                    const { data, error } = await supabase
                        .from("profiles")
                        .update({
                            plan: newPlan,
                            analyses_limit: PLAN_LIMITS[newPlan],
                            subscription_status: currentStatus,
                        })
                        .eq("stripe_subscription_id", subscription.id)
                        .select();

                    if (error) {
                        console.error("Plan update error:", error);
                    } else {
                        console.log(`✅ Plan updated to ${newPlan} with ${PLAN_LIMITS[newPlan]} analyses limit`);
                    }
                } else {
                    const { data, error } = await supabase
                        .from("profiles")
                        .update({
                            subscription_status: currentStatus,
                        })
                        .eq("stripe_subscription_id", subscription.id)
                        .select();

                    if (error) {
                        console.error("Status update error:", error);
                    } else {
                        console.log(`✅ Subscription status updated to ${currentStatus}`);
                    }
                }
            }
        }

        // 4. Invoice Payment Succeeded - reset usage for new month
        if (event.type === "invoice.payment_succeeded") {
            const invoice = event.data.object as Stripe.Invoice;
            
            // Use type assertion to access subscription
            const subscriptionId = (invoice as any).subscription;
            
            if (subscriptionId) {
                const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId;
                
                const { data: userProfile } = await supabase
                    .from("profiles")
                    .select("id, plan")
                    .eq("stripe_subscription_id", subId)
                    .single();

                if (userProfile) {
                    const planLimit = PLAN_LIMITS[userProfile.plan as string] || 3;
                    const { data, error } = await supabase
                        .from("profiles")
                        .update({
                            analyses_used: 0,
                            analyses_limit: planLimit,
                            subscription_status: "active",
                        })
                        .eq("id", userProfile.id)
                        .select();

                    if (error) {
                        console.error("Reset usage error:", error);
                    } else {
                        console.log(`✅ Usage reset for ${userProfile.plan} plan (${planLimit} limit)`);
                    }
                }
            }
        }

        // 5. Invoice Payment Failed
        if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object as Stripe.Invoice;
            
            // Use type assertion to access subscription
            const subscriptionId = (invoice as any).subscription;
            
            if (subscriptionId) {
                const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId;
                
                const { data, error } = await supabase
                    .from("profiles")
                    .update({
                        subscription_status: "past_due",
                    })
                    .eq("stripe_subscription_id", subId)
                    .select();

                if (error) {
                    console.error("Payment failed update error:", error);
                } else {
                    console.log("⚠️ Payment failed, status updated to past_due");
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: unknown) {
        console.error("WEBHOOK ERROR:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});