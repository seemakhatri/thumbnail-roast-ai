-- Replace the unreliable RPC increment with a DB trigger
-- This fires automatically after every report insert, even if the edge function crashes
CREATE OR REPLACE FUNCTION increment_usage_on_report_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.was_cached = FALSE THEN
    UPDATE profiles
    SET analyses_used = analyses_used + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_usage ON reports;
CREATE TRIGGER trg_increment_usage
AFTER INSERT ON reports
FOR EACH ROW EXECUTE FUNCTION increment_usage_on_report_insert();