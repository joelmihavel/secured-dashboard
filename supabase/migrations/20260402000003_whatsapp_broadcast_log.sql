-- Lightweight tracking table for WhatsApp broadcast campaigns
CREATE TABLE IF NOT EXISTS whatsapp_broadcast_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  content_sid TEXT NOT NULL,
  content_variables JSONB,
  audience_filter TEXT NOT NULL,
  total_sent INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  initiated_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role only
ALTER TABLE whatsapp_broadcast_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_broadcast_log_service_role
  ON whatsapp_broadcast_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
