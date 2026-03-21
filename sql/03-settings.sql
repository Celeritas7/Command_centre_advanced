-- =============================================
-- CC Brain Schema: Settings
-- Stores schedule, overrides, and trigger configs
-- Read by scheduler, trigger engine, and settings UI
-- =============================================

CREATE TABLE IF NOT EXISTS command_centre_brain_settings (
  key         text PRIMARY KEY,                       -- 'schedule', 'overrides', 'triggers'
  value       jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz DEFAULT now()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION command_centre_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER command_centre_settings_updated_at_trigger
  BEFORE UPDATE ON command_centre_brain_settings
  FOR EACH ROW
  EXECUTE FUNCTION command_centre_settings_updated_at();

-- RLS
ALTER TABLE command_centre_brain_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "command_centre_settings_all" ON command_centre_brain_settings FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Seed default settings
-- =============================================

-- SCHEDULE: rigid skeleton — time blocks per location/day
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

-- OVERRIDES: 3 override rules
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

-- TRIGGERS: 7 trigger definitions with guard configs
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
