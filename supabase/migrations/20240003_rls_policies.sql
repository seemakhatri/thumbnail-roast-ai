-- Enable RLS on reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can only read their own reports
DROP POLICY IF EXISTS "users_own_reports" ON reports;
CREATE POLICY "users_own_reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can read a report that has a share_slug (public share links)
DROP POLICY IF EXISTS "share_slug_public" ON reports;
CREATE POLICY "share_slug_public" ON reports
  FOR SELECT USING (share_slug IS NOT NULL);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Webhook events table: no user access at all (service role only)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies added = no access for any JWT-authenticated user