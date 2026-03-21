-- =============================================
-- CC Brain — Post-setup verification
-- Run after 00-run-all.sql to confirm everything works
-- =============================================

-- 1. Table counts
SELECT 'command_centre_blockers' as tbl, count(*) FROM command_centre_blockers
UNION ALL SELECT 'command_centre_alerts', count(*) FROM command_centre_alerts
UNION ALL SELECT 'command_centre_active_team', count(*) FROM command_centre_active_team
UNION ALL SELECT 'command_centre_brain_settings', count(*) FROM command_centre_brain_settings;
-- Expected: 0, 0, 1, 3

-- 2. Settings keys
SELECT key, updated_at FROM command_centre_brain_settings ORDER BY key;
-- Expected: overrides, schedule, triggers

-- 3. Active team singleton
SELECT * FROM command_centre_active_team;
-- Expected: singleton row with active_team='coding', location='home'

-- 4. RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('command_centre_blockers','command_centre_alerts','command_centre_active_team','command_centre_brain_settings')
ORDER BY tablename;

-- 5. Test write + read cycle (creates and immediately cleans up)
INSERT INTO command_centre_alerts (type, title, message, renderer, active)
VALUES ('nudge', 'Setup test', 'This is a verification alert', 'nudge', true)
RETURNING id;
-- Copy the returned ID, then:
-- DELETE FROM command_centre_alerts WHERE title = 'Setup test';

-- 6. Check trigger config loaded correctly
SELECT key,
  jsonb_object_keys(value) as trigger_name
FROM command_centre_brain_settings
WHERE key = 'triggers';
-- Expected: 7 rows (gps_shop, office_departure, lunch_time, dinner_time, morning_checkin, timesheet_eod, study_nudge)
