-- migrations/001_initial_schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ──────────────────────────────────────────────
-- TABLE: profiles
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'business', 'agency')),
    analyses_used INTEGER NOT NULL DEFAULT 0 CHECK (analyses_used >= 0),
    analyses_limit INTEGER NOT NULL DEFAULT 3 CHECK (analyses_limit >= 0),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'past_due')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);

-- ──────────────────────────────────────────────
-- TABLE: reports (thumbnail analyses)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_ip INET,
    image_url TEXT NOT NULL,
    share_slug TEXT NOT NULL UNIQUE,
    
    -- AI Scores
    overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    verdict TEXT NOT NULL CHECK (verdict IN ('needs_work', 'decent', 'good', 'strong', 'excellent')),
    roast_title TEXT NOT NULL,
    roast TEXT NOT NULL,
    
    -- Individual Metrics
    ctr_score SMALLINT CHECK (ctr_score BETWEEN 0 AND 100),
    readability_score SMALLINT CHECK (readability_score BETWEEN 0 AND 100),
    emotion_score SMALLINT CHECK (emotion_score BETWEEN 0 AND 100),
    curiosity_score SMALLINT CHECK (curiosity_score BETWEEN 0 AND 100),
    mobile_score SMALLINT CHECK (mobile_score BETWEEN 0 AND 100),
    contrast_score SMALLINT CHECK (contrast_score BETWEEN 0 AND 100),
    face_score SMALLINT CHECK (face_score BETWEEN 0 AND 100),
    brand_score SMALLINT CHECK (brand_score BETWEEN 0 AND 100),
    color_score SMALLINT CHECK (color_score BETWEEN 0 AND 100),
    visual_appeal_score SMALLINT CHECK (visual_appeal_score BETWEEN 0 AND 100),
    
    -- Niche & Context (for benchmarking)
    niche TEXT,
    thumbnail_style TEXT,
    face_present BOOLEAN DEFAULT FALSE,
    text_present BOOLEAN DEFAULT FALSE,
    text_count SMALLINT DEFAULT 0,
    has_arrow BOOLEAN DEFAULT FALSE,
    has_circle BOOLEAN DEFAULT FALSE,
    
    -- JSON Blobs
    strengths JSONB NOT NULL DEFAULT '[]'::JSONB,
    weaknesses JSONB NOT NULL DEFAULT '[]'::JSONB,
    recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
    competitor_insights JSONB NOT NULL DEFAULT '[]'::JSONB,
    
    -- Caching/Performance
    was_cached BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_share_slug ON public.reports(share_slug);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_guest_ip ON public.reports(guest_ip) WHERE guest_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_overall_score ON public.reports(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_niche ON public.reports(niche) WHERE niche IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_verdict ON public.reports(verdict);

-- Composite indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_reports_user_month ON public.reports(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ──────────────────────────────────────────────
-- TABLE: youtube_videos
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.youtube_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    views INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    actual_ctr DECIMAL(5,2) DEFAULT 0,
    average_view_duration INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    
    -- Link to analysis report if analyzed
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_user ON public.youtube_videos(user_id);

-- ──────────────────────────────────────────────
-- TABLE: comparison_sessions
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comparison_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    thumbnail_a UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    thumbnail_b UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    thumbnail_c UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_user ON public.comparison_sessions(user_id);

-- ──────────────────────────────────────────────
-- TABLE: processed_webhook_events
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    stripe_event_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.processed_webhook_events(created_at);

-- ──────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ──────────────────────────────────────────────

-- Auto-update updated_at for profiles
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop trigger if it exists before creating
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at 
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_profiles_updated_at();

-- Auto-update updated_at for youtube_videos
CREATE OR REPLACE FUNCTION public.set_youtube_videos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop trigger if it exists before creating
DROP TRIGGER IF EXISTS youtube_videos_updated_at ON public.youtube_videos;
CREATE TRIGGER youtube_videos_updated_at 
    BEFORE UPDATE ON public.youtube_videos
    FOR EACH ROW EXECUTE FUNCTION public.set_youtube_videos_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, plan, analyses_used, analyses_limit)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        'free',
        0,
        3
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop trigger if it exists before creating
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment usage counter
CREATE OR REPLACE FUNCTION public.increment_analyses_used(user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.profiles
    SET analyses_used = analyses_used + 1
    WHERE id = user_id;
END;
$$;

-- ──────────────────────────────────────────────
-- RLS POLICIES
-- ──────────────────────────────────────────────

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (auth.role() = 'service_role');

-- Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Reports are publicly readable" ON public.reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.reports;
DROP POLICY IF EXISTS "Service role full access on reports" ON public.reports;

CREATE POLICY "Reports are publicly readable" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Users can insert own reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete own reports" ON public.reports FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on reports" ON public.reports FOR ALL USING (auth.role() = 'service_role');

-- YouTube Videos
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Users can insert own videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Users can update own videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Service role full access on videos" ON public.youtube_videos;

CREATE POLICY "Users can read own videos" ON public.youtube_videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON public.youtube_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON public.youtube_videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on videos" ON public.youtube_videos FOR ALL USING (auth.role() = 'service_role');

-- Comparison Sessions
ALTER TABLE public.comparison_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own comparisons" ON public.comparison_sessions;
DROP POLICY IF EXISTS "Users can insert own comparisons" ON public.comparison_sessions;

CREATE POLICY "Users can read own comparisons" ON public.comparison_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comparisons" ON public.comparison_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- VIEWS
-- ──────────────────────────────────────────────

-- User stats view
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
    p.id AS user_id,
    p.plan,
    p.analyses_used,
    p.analyses_limit,
    COUNT(r.id) AS total_analyses,
    ROUND(AVG(r.overall_score)) AS avg_score,
    MAX(r.overall_score) AS best_score,
    MAX(r.created_at) AS last_analysis_at
FROM public.profiles p
LEFT JOIN public.reports r ON r.user_id = p.id
GROUP BY p.id, p.plan, p.analyses_used, p.analyses_limit;

-- Niche benchmarking view
CREATE OR REPLACE VIEW public.niche_benchmarks AS
SELECT
    niche,
    COUNT(*) AS total_samples,
    ROUND(AVG(overall_score)) AS avg_score,
    ROUND(AVG(ctr_score)) AS avg_ctr,
    ROUND(AVG(emotion_score)) AS avg_emotion,
    ROUND(AVG(readability_score)) AS avg_readability,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY overall_score) AS top_10_percentile
FROM public.reports
WHERE niche IS NOT NULL AND overall_score IS NOT NULL
GROUP BY niche
HAVING COUNT(*) >= 10
ORDER BY avg_score DESC;

-- ──────────────────────────────────────────────
-- ADD BUSINESS PLAN TO EXISTING PROFILES
-- ──────────────────────────────────────────────

-- Update the CHECK constraint to include 'business' plan
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_plan_check 
    CHECK (plan IN ('free', 'creator', 'business', 'agency'));

-- Fix any agency users with wrong limit
UPDATE public.profiles 
SET analyses_limit = 500 
WHERE plan = 'agency' AND analyses_limit > 500;

-- Fix any creator users with wrong limit
UPDATE public.profiles 
SET analyses_limit = 50 
WHERE plan = 'creator' AND analyses_limit != 50;

-- Fix any users with 0 limit
UPDATE public.profiles 
SET analyses_limit = 3 
WHERE analyses_limit = 0 OR analyses_limit IS NULL;