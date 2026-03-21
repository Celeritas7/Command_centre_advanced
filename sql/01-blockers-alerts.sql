-- =============================================
-- CC Brain Schema: Blockers & Alerts
-- Command Centre nervous system — message bus tables
-- Run on CC Supabase: https://wylxvmkcrexwfpjpbhyy.supabase.co
-- =============================================

-- command_centre_blockers: full-screen locks that freeze ALL apps
-- Examples: office checkout, timesheet entry, morning Jobcan check-in
-- Blockers are CRITICAL — no app proceeds until dismissed
CREATE TABLE IF NOT EXISTS command_centre_blockers (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL,                          -- 'checkout', 'timesheet', 'checkin'
  message     text NOT NULL,                          -- human-readable lock message
  priority    text DEFAULT 'critical',                -- 'critical' | 'high' | 'normal'
  data        jsonb DEFAULT '{}',                     -- payload: links, form fields, etc.
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by text                                   -- which app dismissed it
);

-- command_centre_alerts: overlay popups on any app (interruptive but dismissable)
-- Examples: cost GPS popup, food reminder, study nudge
-- Alerts push onto the LIFO stack, can be snoozed or completed
CREATE TABLE IF NOT EXISTS command_centre_alerts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL,                          -- 'cost_popup', 'food_reminder', 'nudge', 'timesheet'
  title       text,                                   -- popup title
  message     text,                                   -- popup body
  renderer    text DEFAULT 'nudge',                   -- which built-in renderer: 'checkout', 'timesheet', 'cost_popup', 'food_reminder', 'nudge'
  data        jsonb DEFAULT '{}',                     -- renderer-specific payload
  active      boolean DEFAULT true,
  snoozed_until timestamptz,                          -- if snoozed, when to re-show
  created_at  timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by text                                   -- which app dismissed it
);

-- Indexes for the 60s polling pattern
CREATE INDEX IF NOT EXISTS idx_blockers_active ON command_centre_blockers (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_alerts_active ON command_centre_alerts (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_alerts_snoozed ON command_centre_alerts (snoozed_until) WHERE snoozed_until IS NOT NULL;

-- RLS: public read, public write (single-user system, anon key)
ALTER TABLE command_centre_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_centre_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "command_centre_blockers_all" ON command_centre_blockers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "command_centre_alerts_all" ON command_centre_alerts FOR ALL USING (true) WITH CHECK (true);
