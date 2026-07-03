import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug || slug.length < 6) {
      return errorResponse('Valid slug is required', 400);
    }

    // Use anon key — reports are publicly readable via RLS policy
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: report, error } = await supabase
      .from('reports')
      .select(`
        id, share_slug, image_url, overall_score, verdict,
        roast_title, roast, ctr_score, readability_score,
        emotion_score, curiosity_score, mobile_score,
        contrast_score, face_score, brand_score,
        strengths, weaknesses, recommendations,
        competitor_insights, created_at
      `)
      .eq('share_slug', slug)
      .single();

    if (error || !report) {
      return errorResponse('Report not found', 404);
    }

    return jsonResponse({ report });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});