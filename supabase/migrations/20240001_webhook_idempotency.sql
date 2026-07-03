-- Prevents duplicate Stripe webhook processing
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-clean events older than 30 days (Stripe's retry window is 3 days)
CREATE INDEX IF NOT EXISTS idx_webhook_events_created
ON processed_webhook_events(created_at);