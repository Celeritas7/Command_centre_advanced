-- =============================================
-- CC BRAIN — COMPLETE SCHEMA (run once)
-- Supabase: https://wylxvmkcrexwfpjpbhyy.supabase.co
-- Paste entire file into SQL Editor → Run
-- =============================================

-- ========== 1. BLOCKERS & ALERTS ==========

CREATE TABLE IF NOT EXISTS command_centre_blockers (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL,
  message     text NOT NULL,
  priority    text DEFAULT 'critical',
  data        jsonb DEFAULT '{}',
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by text
);

CREATE TABLE IF NOT EXISTS command_centre_alerts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL,
  title       text,
  message     text,
  renderer    text DEFAULT 'nudge',
  data        jsonb DEFAULT '{}',
  active      boolean DEFAULT true,
  snoozed_until timestamptz,
  created_at  timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by text
);

CREATE INDEX IF NOT EXISTS idx_blockers_active ON command_centre_blockers (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_alerts_active ON command_centre_alerts (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_alerts_snoozed ON command_centre_alerts (snoozed_until) WHERE snoozed_until IS NOT NULL;

ALTER TABLE command_centre_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_centre_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'command_centre_blockers_all') THEN
    CREATE POLICY "command_centre_blockers_all" ON command_centre_blockers FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'command_centre_alerts_all') THEN
    CREATE POLICY "command_centre_alerts_all" ON command_centre_alerts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ========== 2. ACTIVE TEAM (LIFO STACK) ==========

CREATE TABLE IF NOT EXISTS command_centre_active_team (
  id              text DEFAULT 'singleton' PRIMARY KEY,
  active_team     text NOT NULL DEFAULT 'coding',
  base_team       text NOT NULL DEFAULT 'coding',
  interrupt_stack jsonb DEFAULT '[]',
  location        text DEFAULT 'home',
  last_location_change timestamptz DEFAULT now(),
  schedule_slot   text,
  updated_at      timestamptz DEFAULT now()
);

INSERT INTO command_centre_active_team (id, active_team, base_team, location)
VALUES ('singleton', 'coding', 'coding', 'home')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE command_centre_active_team ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'command_centre_active_team_all') THEN
    CREATE POLICY "command_centre_active_team_all" ON command_centre_active_team FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION command_centre_active_team_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS command_centre_active_team_updated_at_trigger ON command_centre_active_team;
CREATE TRIGGER command_centre_active_team_updated_at_trigger
  BEFORE UPDATE ON command_centre_active_team
  FOR EACH ROW
  EXECUTE FUNCTION command_centre_active_team_updated_at();

-- ========== 3. BRAIN SETTINGS ==========

CREATE TABLE IF NOT EXISTS command_centre_brain_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION command_centre_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS command_centre_settings_updated_at_trigger ON command_centre_brain_settings;
CREATE TRIGGER command_centre_settings_updated_at_trigger
  BEFORE UPDATE ON command_centre_brain_settings
  FOR EACH ROW
  EXECUTE FUNCTION command_centre_settings_updated_at();

ALTER TABLE command_centre_brain_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'command_centre_settings_all') THEN
    CREATE POLICY "command_centre_settings_all" ON command_centre_brain_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ========== SEED: Schedule ==========
INSERT INTO command_centre_brain_settings (key, value) VALUES ('schedule', '{
  "weekday": {
    "home_morning": [
      {"from": "06:00", "to": "07:00", "team": "exercise"},
      {"from": "07:00", "to": "07:30", "team": "food"},
      {"from": "07:30", "to": "08:00", "team": "grooming"}
    ],
    "office": [
      {"from": "09:00", "to": "12:00", "team": "work"},
      {"from": "12:00", "to": "13:00", "team": "lunch"},
      {"from": "13:00", "to": "18:00", "team": "work"}
    ],
    "home_evening": [
      {"from": "18:30", "to": "19:30", "team": "language_study"},
      {"from": "19:30", "to": "20:30", "team": "food"},
      {"from": "20:30", "to": "22:00", "team": "coding"},
      {"from": "22:00", "to": "22:30", "team": "sleep_prep"}
    ]
  },
  "weekend": {
    "home": [
      {"from": "07:00", "to": "08:00", "team": "exercise"},
      {"from": "08:00", "to": "09:00", "team": "food"},
      {"from": "09:00", "to": "13:00", "team": "defender_mid"},
      {"from": "13:00", "to": "14:00", "team": "food"},
      {"from": "14:00", "to": "18:00", "team": "coding"},
      {"from": "18:00", "to": "19:00", "team": "language_study"},
      {"from": "19:00", "to": "20:00", "team": "food"},
      {"from": "20:00", "to": "22:00", "team": "free"},
      {"from": "22:00", "to": "22:30", "team": "sleep_prep"}
    ]
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ========== SEED: Overrides ==========
INSERT INTO command_centre_brain_settings (key, value) VALUES ('overrides', '{
  "weekend_shields_up": {
    "enabled": true,
    "description": "Weekend before 1 PM: force defender/mid tasks before attackers",
    "before_hour": 13,
    "forced_teams": ["defender", "mid"]
  },
  "credit_emergency": {
    "enabled": true,
    "description": "If any squad credits < 10, force that squad next",
    "threshold": 10
  },
  "all_done_shift": {
    "enabled": true,
    "description": "If all scheduled tasks done, shift to free time or next priority",
    "fallback_team": "free"
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ========== SEED: Triggers ==========
INSERT INTO command_centre_brain_settings (key, value) VALUES ('triggers', '{
  "gps_shop": {
    "enabled": true,
    "description": "Near a shop → cost popup",
    "type": "gps",
    "cooldown_min": 15,
    "renderer": "cost_popup"
  },
  "office_departure": {
    "enabled": true,
    "description": "Left office without checkout → blocker",
    "type": "gps",
    "check": "jobcan_status",
    "renderer": "checkout"
  },
  "lunch_time": {
    "enabled": true,
    "description": "12:00 weekday → food reminder",
    "type": "time",
    "time": "12:00",
    "days": ["weekday"],
    "renderer": "food_reminder"
  },
  "dinner_time": {
    "enabled": true,
    "description": "19:00 → food reminder",
    "type": "time",
    "time": "19:00",
    "days": ["weekday", "weekend"],
    "renderer": "food_reminder"
  },
  "morning_checkin": {
    "enabled": true,
    "description": "Arrive office → Jobcan check-in blocker",
    "type": "gps",
    "location": "office",
    "renderer": "checkout"
  },
  "timesheet_eod": {
    "enabled": true,
    "description": "17:30 weekday office → timesheet reminder",
    "type": "time",
    "time": "17:30",
    "days": ["weekday"],
    "location": "office",
    "renderer": "timesheet"
  },
  "study_nudge": {
    "enabled": true,
    "description": "18:30 weekday home → language study nudge",
    "type": "time",
    "time": "18:30",
    "days": ["weekday"],
    "location": "home",
    "renderer": "nudge",
    "nudge_message": "Language study time — open JLPT or Grammar app"
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ========== VERIFICATION QUERY ==========
-- Run this after to confirm everything landed:
SELECT 'command_centre_blockers' as tbl, count(*) FROM command_centre_blockers
UNION ALL SELECT 'command_centre_alerts', count(*) FROM command_centre_alerts
UNION ALL SELECT 'command_centre_active_team', count(*) FROM command_centre_active_team
UNION ALL SELECT 'command_centre_brain_settings', count(*) FROM command_centre_brain_settings;
-- Expected: blockers=0, alerts=0, active_team=1, settings=3
