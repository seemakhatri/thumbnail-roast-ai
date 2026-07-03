-- Speeds up the monthly usage count query (runs on every analysis)
CREATE INDEX IF NOT EXISTS idx_reports_user_month
ON reports(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Speeds up guest rate limiting query (runs on every guest analysis)
CREATE INDEX IF NOT EXISTS idx_reports_guest_ip_time
ON reports(guest_ip, created_at DESC)
WHERE user_id IS NULL;

-- Unique index for share_slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_share_slug
ON reports(share_slug);

-- Add was_cached column if it doesn't exist
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS was_cached BOOLEAN DEFAULT FALSE;