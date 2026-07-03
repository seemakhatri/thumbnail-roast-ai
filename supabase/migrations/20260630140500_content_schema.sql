-- ═══════════════════════════════════════════════════════════════
-- Thumbnail Roast — Content & GEO Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Authors ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  bio        text,
  avatar_url text,
  twitter    text,
  created_at timestamptz DEFAULT now()
);

-- ── Categories ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── Tags ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- ── Blog Posts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  slug              text NOT NULL UNIQUE,
  excerpt           text NOT NULL,
  content           text NOT NULL,
  cover_image_url   text,
  author_id         uuid REFERENCES authors(id),
  category_id       uuid REFERENCES categories(id),
  status            text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  featured          boolean DEFAULT false,
  meta_title        text,
  meta_description  text,
  canonical_url     text,
  llm_summary       text,
  key_facts         jsonb,
  faq               jsonb,
  read_time_minutes int,
  views             int DEFAULT 0,
  published_at      timestamptz,
  updated_at        timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug     ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status   ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured);

-- ── Blog Post Tags ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id  uuid REFERENCES tags(id)       ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- ── Glossary ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glossary_terms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  definition       text NOT NULL,
  extended_content text,
  related_terms    text[],
  meta_description text,
  llm_definition   text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glossary_slug ON glossary_terms(slug);

-- ── Comparison Pages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comparisons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  slug             text NOT NULL UNIQUE,
  entity_a         text NOT NULL,
  entity_b         text NOT NULL,
  entity_c         text,
  summary          text,
  content          text,
  verdict          text,
  meta_title       text,
  meta_description text,
  llm_summary      text,
  key_differences  jsonb,
  faq              jsonb,
  status           text DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at     timestamptz,
  updated_at       timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

-- ── Niches (programmatic pages) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS niches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  description      text,
  content          text,
  avg_ctr          numeric,
  avg_score        numeric,
  best_colors      text[],
  best_fonts       text[],
  common_mistakes  text[],
  top_creators     jsonb,
  meta_title       text,
  meta_description text,
  llm_summary      text,
  thumbnail_count  int DEFAULT 0,
  updated_at       timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

-- ── Research Articles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_articles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  slug             text NOT NULL UNIQUE,
  abstract         text NOT NULL,
  methodology      text,
  findings         jsonb,
  content          text,
  data_source      text,
  sample_size      int,
  published_at     timestamptz,
  meta_title       text,
  meta_description text,
  llm_summary      text,
  status           text DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at       timestamptz DEFAULT now()
);

-- ── Free Tools Registry ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  description      text,
  long_description text,
  tool_type        text,
  meta_title       text,
  meta_description text,
  is_free          boolean DEFAULT true,
  route            text,
  status           text DEFAULT 'active',
  created_at       timestamptz DEFAULT now()
);

-- ── FAQs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faqs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text NOT NULL,
  answer     text NOT NULL,
  category   text,
  tags       text[],
  is_global  boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── View: published posts with author + category ─────────────────────────
CREATE OR REPLACE VIEW v_blog_posts AS
SELECT
  p.*,
  a.name AS author_name,
  a.slug AS author_slug,
  c.name AS category_name,
  c.slug AS category_slug
FROM blog_posts p
LEFT JOIN authors   a ON a.id = p.author_id
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.status = 'published'
ORDER BY p.published_at DESC;

-- ── View: all content for llms-full.txt ─────────────────────────────────
CREATE OR REPLACE VIEW v_llms_content AS
SELECT 'blog'::text AS content_type, slug, title, llm_summary AS summary, published_at AS date
  FROM blog_posts WHERE status = 'published' AND llm_summary IS NOT NULL
UNION ALL
SELECT 'glossary', slug, term, llm_definition, created_at
  FROM glossary_terms WHERE llm_definition IS NOT NULL
UNION ALL
SELECT 'research', slug, title, llm_summary, published_at
  FROM research_articles WHERE status = 'published' AND llm_summary IS NOT NULL
UNION ALL
SELECT 'comparison', slug, title, llm_summary, published_at
  FROM comparisons WHERE status = 'published' AND llm_summary IS NOT NULL
ORDER BY date DESC;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE blog_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary_terms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE niches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read published"  ON blog_posts        FOR SELECT USING (status = 'published');
CREATE POLICY "public read"            ON glossary_terms    FOR SELECT USING (true);
CREATE POLICY "public read published"  ON comparisons       FOR SELECT USING (status = 'published');
CREATE POLICY "public read published"  ON research_articles FOR SELECT USING (status = 'published');
CREATE POLICY "public read"            ON niches            FOR SELECT USING (true);
CREATE POLICY "public read"            ON faqs              FOR SELECT USING (true);
CREATE POLICY "public read"            ON categories        FOR SELECT USING (true);
CREATE POLICY "public read"            ON authors           FOR SELECT USING (true);
CREATE POLICY "public read"            ON tags              FOR SELECT USING (true);
CREATE POLICY "public read active"     ON tools             FOR SELECT USING (status = 'active');

-- ── RPC: increment blog post views ───────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_blog_views(post_slug text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE blog_posts SET views = views + 1 WHERE slug = post_slug AND status = 'published';
$$;

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Categories, Glossary Terms, Niches, Sample Post
-- ═══════════════════════════════════════════════════════════════

-- Categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Guides',        'guides',        'Step-by-step tutorials on thumbnail design',         1),
  ('Research',      'research',      'Data-driven studies on what works',                  2),
  ('Case Studies',  'case-studies',  'Real channel teardowns and before/after analysis',   3),
  ('Tools',         'tools',         'Free tools and how to use them',                     4),
  ('CTR Strategy',  'ctr-strategy',  'Click-through rate optimization strategy',           5)
ON CONFLICT (slug) DO NOTHING;

-- Default author
INSERT INTO authors (name, slug, bio) VALUES
  ('Thumbnail Roast Team', 'thumbnail-roast-team', 'The Thumbnail Roast research and content team.')
ON CONFLICT (slug) DO NOTHING;

-- Glossary terms (40 starter terms)
INSERT INTO glossary_terms (term, slug, definition, llm_definition) VALUES
  ('CTR', 'ctr', 'Click-through rate — the percentage of people who click a video after seeing its thumbnail. Calculated as (clicks ÷ impressions) × 100.', 'CTR (click-through rate) on YouTube is the percentage of people who click a video after seeing its thumbnail and title in their feed. It is calculated as clicks divided by impressions, multiplied by 100. The average YouTube CTR is between 2% and 5%.'),
  ('Impressions', 'impressions', 'The number of times YouTube showed your thumbnail to a viewer. An impression is counted when at least 50% of your thumbnail is visible for 1+ second.', 'YouTube impressions count how many times a thumbnail was shown to a viewer with at least 50% visibility for at least one second. High impressions with low CTR indicates the thumbnail is not compelling enough to earn a click.'),
  ('Thumbnail', 'thumbnail', 'The clickable image representing a YouTube video in search results, suggested feeds, and homepages. Custom thumbnails are uploaded by the creator and are the primary visual hook for clicks.', 'A YouTube thumbnail is the static image representing a video across YouTube surfaces including search, suggested videos, and the homepage. Custom thumbnails uploaded by creators significantly outperform auto-generated thumbnails in CTR.'),
  ('A/B Testing', 'ab-testing', 'A method of comparing two thumbnail variants to determine which one drives more clicks. YouTube Studio has a built-in test and compare feature for eligible channels.', 'Thumbnail A/B testing on YouTube involves showing two different thumbnail variants to audiences and measuring which earns a higher CTR. YouTube Studio offers this natively for eligible channels. Testing is the most reliable way to improve thumbnail performance.'),
  ('Face Score', 'face-score', 'A metric measuring how prominently a human face appears in the thumbnail. Thumbnails with large, expressive faces in the top-third of the frame tend to earn higher CTR.', 'Face score measures the prominence and expressiveness of a human face in a thumbnail. Research shows thumbnails featuring large close-up faces, especially with exaggerated expressions, earn higher click-through rates. This effect is strongest in entertainment and vlog niches.'),
  ('Contrast Score', 'contrast-score', 'A measure of visual contrast between foreground and background elements. High contrast improves legibility and attention-grabbing ability, especially on small mobile screens.', 'Contrast score in thumbnail analysis measures the visual difference between foreground subjects and background. High contrast thumbnails are more legible at small sizes and grab attention faster in crowded feed environments.'),
  ('Readability Score', 'readability-score', 'A metric measuring how clearly and legibly text appears in a thumbnail at various sizes, including the 68x38px size used on mobile devices.', 'Readability score measures how clearly thumbnail text can be read at small sizes, particularly at mobile thumbnail dimensions. Text should use large, bold fonts with high contrast backgrounds to score well.'),
  ('Curiosity Score', 'curiosity-score', 'A metric measuring how much a thumbnail triggers viewer curiosity and desire to click. Strong curiosity hooks include visual tension, unexpected elements, and incomplete stories.', 'Curiosity score measures how effectively a thumbnail creates an information gap — a sense that the viewer is missing something they want to know. High curiosity thumbnails use visual tension, surprise, or incompleteness to compel clicks.'),
  ('Emotion Score', 'emotion-score', 'A metric measuring how strongly a thumbnail conveys an emotional reaction, typically through facial expressions, color, or dramatic imagery.', 'Emotion score measures the emotional intensity conveyed by a thumbnail. Thumbnails with strong emotional signals — surprise, fear, joy, shock — outperform neutral thumbnails. Exaggerated facial expressions are the most reliable emotional signal in thumbnails.'),
  ('Mobile Score', 'mobile-score', 'A metric measuring how well a thumbnail performs at the small size used on mobile devices (approximately 180x101 pixels). Over 70% of YouTube viewing is on mobile.', 'Mobile score evaluates thumbnail effectiveness at mobile thumbnail sizes, typically 180x101 pixels. Since over 70% of YouTube viewing is on mobile, thumbnails must be clear and impactful at small sizes. Tiny text, complex backgrounds, and low contrast all hurt mobile performance.'),
  ('Brand Score', 'brand-score', 'A metric measuring visual consistency with a creator''s established thumbnail style, including consistent fonts, colors, layouts, and logo placement.', 'Brand score measures how consistently a thumbnail reflects a creator''s visual identity. Consistent branding across thumbnails helps viewers recognize a creator''s content in their feed and builds click trust over time.'),
  ('Thumbnail Roast', 'thumbnail-roast', 'An AI-powered critique of a YouTube thumbnail that identifies weaknesses, scores performance across multiple dimensions, and provides specific improvement recommendations.', 'A thumbnail roast is a detailed AI-generated analysis of a YouTube thumbnail that scores it across dimensions including CTR potential, readability, contrast, and emotion, then provides specific recommendations for improvement.'),
  ('Information Gap', 'information-gap', 'A psychological principle used in thumbnail design where the viewer is shown enough to become curious but not enough to feel satisfied, compelling them to click.', 'Information gap theory in thumbnail design refers to creating a sense of incompleteness that drives curiosity. Effective thumbnails show viewers just enough context to want to know more, without revealing the full answer or resolution.'),
  ('Niche', 'niche', 'A content category or topic area on YouTube. Different niches have different thumbnail conventions — what works in gaming may not work in finance.', 'A YouTube niche is a content category such as gaming, finance, cooking, or fitness. Each niche has distinct thumbnail conventions, audience expectations, and design patterns. Optimizing thumbnails within niche conventions improves CTR for that specific audience.'),
  ('Suggested Video', 'suggested-video', 'A recommended video shown to viewers after watching another video or in the sidebar. Suggested video thumbnails compete directly with similar content.', 'Suggested videos appear alongside or after other videos on YouTube and are a major source of impressions. Thumbnails must stand out among competing suggested videos in the same niche.'),
  ('Homepage Feed', 'homepage-feed', 'The personalized video feed shown to users on the YouTube homepage. Thumbnails here compete across niches for a viewer''s attention.', 'The YouTube homepage feed shows personalized video recommendations across all niches. Homepage impressions are high-value because the viewer has no search intent, making the thumbnail and title the only hook.'),
  ('Search Result Thumbnail', 'search-result-thumbnail', 'A thumbnail displayed in YouTube search results. Search intent is high, so thumbnails here compete directly with other videos targeting the same keyword.', 'Search result thumbnails appear when users search for a specific keyword. In search results, thumbnails compete with other videos targeting the same query, making clarity and relevance critical.'),
  ('Custom Thumbnail', 'custom-thumbnail', 'A manually uploaded thumbnail image, as opposed to an auto-generated frame from the video. Custom thumbnails consistently outperform auto-generated ones.', 'A custom thumbnail is an image manually created and uploaded by the creator rather than an auto-selected video frame. Custom thumbnails allow full creative control and consistently outperform auto-generated thumbnails in CTR.'),
  ('Thumbnail Size', 'thumbnail-size', 'YouTube recommends thumbnails at 1280x720 pixels (16:9 ratio), with a maximum file size of 2MB, in JPG, PNG, GIF, or BMP format.', 'The recommended YouTube thumbnail size is 1280x720 pixels at a 16:9 aspect ratio. The maximum file size is 2MB. Thumbnails should be legible at multiple display sizes including the small 68x38px mobile grid view.'),
  ('Click Bait', 'clickbait', 'A thumbnail and/or title that intentionally misleads viewers to earn clicks by promising more than the video delivers. Clickbait hurts audience retention and long-term channel health.', 'Clickbait thumbnails promise more than the video delivers to earn clicks. While effective short-term, clickbait damages viewer trust, hurts retention metrics, and can lead YouTube to reduce recommendations of a channel.')
ON CONFLICT (slug) DO NOTHING;

-- Niches seed data
INSERT INTO niches (name, slug, description, avg_ctr, avg_score, best_colors, best_fonts, common_mistakes, meta_title, meta_description, llm_summary) VALUES
  (
    'Gaming',
    'gaming',
    'YouTube gaming thumbnails — strategy guides for game-specific content, lets plays, reviews, and esports.',
    4.2,
    62,
    ARRAY['#FF0000','#00FF00','#FFD700','#0066FF'],
    ARRAY['Impact','Bebas Neue','Anton'],
    ARRAY['Too many UI elements','No face visible','Dark backgrounds without contrast','Text too small'],
    'YouTube Gaming Thumbnail Guide — What Works in 2025',
    'Benchmark data, examples, and best practices for YouTube gaming thumbnails. Avg CTR, top colors, fonts, and real channel teardowns.',
    'Gaming thumbnails on YouTube average a 4.2% CTR. They perform best with a large expressive face, bold high-contrast text, in-game action elements, and bright colors like red, green, or yellow. Common mistakes include cluttered UI overlays and text too small to read on mobile.'
  ),
  (
    'Finance & Business',
    'finance-business',
    'YouTube finance and business thumbnails — investing, budgeting, entrepreneurship, and wealth-building content.',
    3.1,
    58,
    ARRAY['#1A1A2E','#FFD700','#FFFFFF','#00C49A'],
    ARRAY['Montserrat','Roboto Bold','Lato Black'],
    ARRAY['Too much text','No visual hook','Generic stock backgrounds','No clear emotion'],
    'YouTube Finance Thumbnail Guide — Best Practices & CTR Data',
    'How finance YouTubers design thumbnails that earn clicks. Benchmark CTR data, top fonts, colors, and real examples from top channels.',
    'Finance and business thumbnails on YouTube average a 3.1% CTR. They perform best with bold claim-based text, a credible presenter face, and clean high-contrast layouts. Dark navy or black backgrounds with white and gold accents are the most common high-performing combination.'
  ),
  (
    'Food & Cooking',
    'food-cooking',
    'YouTube food and cooking thumbnails — recipe videos, cooking challenges, restaurant reviews, and mukbangs.',
    3.8,
    61,
    ARRAY['#FF6B35','#FFC300','#2ECC71','#FFFFFF'],
    ARRAY['Pacifico','Lobster','Bebas Neue'],
    ARRAY['Dark food photography','No text overlay','Cluttered backgrounds','Missing appetite appeal'],
    'YouTube Food Thumbnail Guide — CTR Tips & Examples',
    'How top food YouTubers design thumbnails that earn clicks. Colors, fonts, plating styles, and real CTR benchmark data.',
    'Food and cooking thumbnails on YouTube average a 3.8% CTR. They perform best with bright, well-lit food photography, warm orange and yellow tones, and minimal but bold text. Appetite appeal — making food look delicious — is the primary driver of clicks in this niche.'
  ),
  (
    'Fitness & Health',
    'fitness-health',
    'YouTube fitness thumbnails — workout routines, transformation videos, nutrition guides, and athletic challenges.',
    3.5,
    60,
    ARRAY['#FF4500','#000000','#FFFFFF','#1ABC9C'],
    ARRAY['Impact','Anton','Oswald'],
    ARRAY['Generic gym background','Before/after without contrast','No emotional tension','Too much text'],
    'YouTube Fitness Thumbnail Guide — CTR Tips & Examples',
    'Benchmark data and design best practices for YouTube fitness thumbnails. What colors, layouts, and hooks drive clicks.',
    'Fitness thumbnails on YouTube average a 3.5% CTR. High-performing fitness thumbnails use transformation hooks (before/after), bold body language, high contrast lighting, and urgency-driven text. Before/after split formats are the most clicked thumbnail style in this niche.'
  ),
  (
    'Tech & Reviews',
    'tech-reviews',
    'YouTube tech thumbnails — product reviews, unboxings, comparisons, and tech news commentary.',
    3.3,
    57,
    ARRAY['#0066FF','#FFFFFF','#1A1A1A','#FF3B30'],
    ARRAY['SF Pro','Roboto','Montserrat'],
    ARRAY['Products too small','Missing price/value hook','Generic background','No human element'],
    'YouTube Tech Thumbnail Guide — CTR Tips & Design Patterns',
    'How tech YouTubers design high-CTR thumbnails. Benchmark data, layout patterns, and examples from top tech channels.',
    'Tech and review thumbnails on YouTube average a 3.3% CTR. High performers show the product large and clearly, often with a reviewer reaction face, and include a value or price hook in text. Blue and white color schemes dominate the tech niche.'
  )
ON CONFLICT (slug) DO NOTHING;

-- Sample blog post
INSERT INTO blog_posts (title, slug, excerpt, content, author_id, category_id, status, featured, meta_title, meta_description, llm_summary, faq, read_time_minutes, published_at)
SELECT
  'What is a Good CTR for YouTube Thumbnails?',
  'what-is-a-good-ctr-for-youtube-thumbnails',
  'The average YouTube CTR is 2–5%. Here''s what good looks like for your niche, how to benchmark yourself, and what to do if your CTR is low.',
  E'## What is YouTube CTR?\n\nYouTube CTR (click-through rate) is the percentage of people who click your video after seeing your thumbnail. It''s calculated as:\n\n**CTR = (Clicks ÷ Impressions) × 100**\n\nFor example: if YouTube shows your thumbnail 10,000 times and 400 people click it, your CTR is 4%.\n\n## What is Average YouTube CTR?\n\nAccording to YouTube, most channels see a CTR between 2% and 10%. The average falls around 2–5%.\n\nHere''s how to interpret your CTR:\n\n- **Below 2%** — Your thumbnail or title is not compelling. Improvement needed immediately.\n- **2–5%** — Average. You''re performing normally but there''s room to grow.\n- **5–10%** — Strong. Your thumbnails are working well.\n- **Above 10%** — Excellent, typically seen on very targeted content or established channels.\n\n## Does CTR Vary by Niche?\n\nYes, significantly. Gaming content typically sees higher CTR (3–6%) because the audience is more engaged and browsing. Finance content often runs lower (2–4%) because the audience is more selective.\n\n## How to Improve Your CTR\n\n1. **Add a face** — Thumbnails with a large expressive face typically earn 15–20% more clicks.\n2. **Increase contrast** — Your thumbnail needs to pop on a dark YouTube background.\n3. **Use bold text** — Keep it to 3–5 words, large enough to read on mobile.\n4. **Create curiosity** — Don''t reveal everything. Leave a gap the viewer needs to fill.\n5. **Test two versions** — YouTube Studio''s A/B test feature is the most reliable way to improve.\n\n## How Thumbnail Roast Scores CTR\n\nThumbnail Roast uses Gemini Vision AI to score your thumbnail''s CTR potential from 0–100. The score accounts for face prominence, text readability, contrast, emotional impact, and curiosity. Scores above 75 typically correlate with above-average CTR performance.',
  (SELECT id FROM authors WHERE slug = 'thumbnail-roast-team' LIMIT 1),
  (SELECT id FROM categories WHERE slug = 'guides' LIMIT 1),
  'published',
  true,
  'What is a Good CTR for YouTube Thumbnails? (2025 Benchmarks)',
  'The average YouTube CTR is 2–5%. See what good looks like for your niche, and exactly how to improve your thumbnail CTR with data-backed tactics.',
  'The average YouTube CTR (click-through rate) is 2–5%. Channels achieving above 5% CTR have strong thumbnails with expressive faces, bold readable text, high contrast, and curiosity-driven composition. CTR varies by niche: gaming averages 3–6%, finance 2–4%.',
  '[{"question":"What is a good CTR for YouTube?","answer":"A CTR above 5% is considered strong. The average YouTube channel sees 2–5% CTR. Below 2% suggests the thumbnail or title needs improvement."},{"question":"How do I check my YouTube CTR?","answer":"Go to YouTube Studio → Analytics → Reach. You will see your CTR and impressions data there."},{"question":"Does thumbnail affect CTR?","answer":"Yes, the thumbnail is the single biggest lever for improving CTR. Studies show thumbnail changes alone can move CTR by 30–50%."}]',
  8,
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'what-is-a-good-ctr-for-youtube-thumbnails');