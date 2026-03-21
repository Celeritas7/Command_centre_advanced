-- =============================================
-- CC Brain Schema: Active Team (v2 — LIFO stack)
-- Tracks current priority state across all apps
-- Only CC writes; all apps read
-- =============================================

-- command_centre_active_team: single row tracking the current priority state
-- Uses a JSONB interrupt_stack instead of single interrupted_by
-- Stack pattern: push on interrupt, pop on dismiss, clear on location change
CREATE TABLE IF NOT EXISTS command_centre_active_team (
  id              text DEFAULT 'singleton' PRIMARY KEY,  -- always one row
  active_team     text NOT NULL DEFAULT 'coding',        -- current active squad name
  base_team       text NOT NULL DEFAULT 'coding',        -- the "home" team before any interrupts
  interrupt_stack jsonb DEFAULT '[]',                     -- LIFO stack: [{team, reason, pushed_at, alert_id}]
  location        text DEFAULT 'home',                    -- 'home' | 'office' | 'outside'
  last_location_change timestamptz DEFAULT now(),
  schedule_slot   text,                                   -- current scheduler slot name
  updated_at      timestamptz DEFAULT now()
);

-- Seed the singleton row
INSERT INTO command_centre_active_team (id, active_team, base_team, location)
VALUES ('singleton', 'coding', 'coding', 'home')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE command_centre_active_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "command_centre_active_team_all" ON command_centre_active_team FOR ALL USING (true) WITH CHECK (true);

-- Helper: update trigger to keep updated_at current
CREATE OR REPLACE FUNCTION command_centre_active_team_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER command_centre_active_team_updated_at_trigger
  BEFORE UPDATE ON command_centre_active_team
  FOR EACH ROW
  EXECUTE FUNCTION command_centre_active_team_updated_at();
