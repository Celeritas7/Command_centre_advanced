// =============================================
// CC Brain Trigger Engine
// Runs inside Command Centre only (the brain)
// Evaluates GPS + time conditions → writes alerts/blockers
// =============================================

const CC_TRIGGERS = (() => {
  // --- GPS coords ---
  const LOCATIONS = {
    home:   { lat: 35.7089, lng: 139.9454, radius: 500 },
    office: { lat: 35.5791, lng: 139.7485, radius: 500 },
  };

  // --- Guard state (prevents duplicate fires) ---
  // { triggerKey: { lastFired: timestamp, cooldownMs: number } }
  const guards = {};

  // --- Settings cache ---
  let triggerConfig = null;
  let configLoadedAt = 0;
  const CONFIG_TTL = 5 * 60 * 1000; // 5 min cache

  // --- Helpers ---
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function detectLocation(lat, lng) {
    for (const [name, loc] of Object.entries(LOCATIONS)) {
      if (haversine(lat, lng, loc.lat, loc.lng) <= loc.radius) return name;
    }
    return 'outside';
  }

  function isWeekday() {
    const d = new Date().getDay();
    return d >= 1 && d <= 5;
  }

  function currentHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function guardCheck(key, cooldownMin = 15) {
    const now = Date.now();
    const g = guards[key];
    if (g && (now - g.lastFired) < cooldownMin * 60 * 1000) return false;
    guards[key] = { lastFired: now, cooldownMs: cooldownMin * 60 * 1000 };
    return true;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // --- Load trigger config from command_centre_brain_settings ---
  async function loadConfig(sb) {
    if (triggerConfig && (Date.now() - configLoadedAt) < CONFIG_TTL) return triggerConfig;
    try {
      const { data } = await sb.from('command_centre_brain_settings').select('value').eq('key', 'triggers').single();
      triggerConfig = data?.value || {};
      configLoadedAt = Date.now();
    } catch (e) {
      console.warn('[CC Triggers] Config load failed, using cached:', e);
    }
    return triggerConfig || {};
  }

  // --- Write helpers ---
  async function writeAlert(sb, { type, title, message, renderer, data }) {
    return sb.from('command_centre_alerts').insert({
      type, title, message, renderer: renderer || 'nudge', data: data || {}, active: true
    });
  }

  async function writeBlocker(sb, { type, message, priority, data }) {
    return sb.from('command_centre_blockers').insert({
      type, message, priority: priority || 'critical', data: data || {}, active: true
    });
  }

  // --- The 7 Triggers ---

  // 1. GPS shop detection → cost popup
  async function triggerGpsShop(sb, lat, lng, shopName) {
    const cfg = (await loadConfig(sb)).gps_shop;
    if (!cfg?.enabled) return;
    if (!guardCheck('gps_shop', cfg.cooldown_min || 15)) return;
    await writeAlert(sb, {
      type: 'cost_popup',
      title: 'Log expense',
      message: `Near ${shopName}. Did you buy something?`,
      renderer: 'cost_popup',
      data: { shop: shopName, lat, lng }
    });
  }

  // 2. Office departure without checkout → blocker
  async function triggerOfficeDeparture(sb, jobcanCheckedOut, checkoutLinks) {
    const cfg = (await loadConfig(sb)).office_departure;
    if (!cfg?.enabled) return;
    if (jobcanCheckedOut) return; // already checked out
    if (!guardCheck('office_departure_' + todayKey(), 60)) return;
    await writeBlocker(sb, {
      type: 'checkout',
      message: 'Check out of Jobcan and submit timesheet',
      priority: 'critical',
      data: { links: checkoutLinks || [], renderer: 'checkout' }
    });
  }

  // 3. Lunch time → food reminder
  async function triggerLunchTime(sb) {
    const cfg = (await loadConfig(sb)).lunch_time;
    if (!cfg?.enabled) return;
    if (!isWeekday()) return;
    const hhmm = currentHHMM();
    if (hhmm < '11:50' || hhmm > '12:10') return;
    if (!guardCheck('lunch_' + todayKey(), 120)) return;
    await writeAlert(sb, {
      type: 'food_reminder',
      title: 'Lunch time',
      message: 'Time to eat. Check your food plan.',
      renderer: 'food_reminder',
      data: { meal: 'lunch', tasks: ['Check fridge inventory', 'Heat/cook lunch', 'Clean up'] }
    });
  }

  // 4. Dinner time → food reminder
  async function triggerDinnerTime(sb) {
    const cfg = (await loadConfig(sb)).dinner_time;
    if (!cfg?.enabled) return;
    const hhmm = currentHHMM();
    if (hhmm < '18:50' || hhmm > '19:10') return;
    if (!guardCheck('dinner_' + todayKey(), 120)) return;
    await writeAlert(sb, {
      type: 'food_reminder',
      title: 'Dinner time',
      message: 'Time to prepare dinner.',
      renderer: 'food_reminder',
      data: { meal: 'dinner', tasks: ['Plan dish', 'Cook meal', 'Prep tomorrow lunch'] }
    });
  }

  // 5. Morning office check-in
  async function triggerMorningCheckin(sb, location, jobcanCheckedIn, checkinLinks) {
    const cfg = (await loadConfig(sb)).morning_checkin;
    if (!cfg?.enabled) return;
    if (location !== 'office') return;
    if (jobcanCheckedIn) return;
    if (!isWeekday()) return;
    if (!guardCheck('morning_checkin_' + todayKey(), 480)) return;
    await writeBlocker(sb, {
      type: 'checkin',
      message: 'Check in to Jobcan',
      priority: 'critical',
      data: { links: checkinLinks || [], renderer: 'checkout' }
    });
  }

  // 6. Timesheet EOD
  async function triggerTimesheetEOD(sb, location) {
    const cfg = (await loadConfig(sb)).timesheet_eod;
    if (!cfg?.enabled) return;
    if (!isWeekday() || location !== 'office') return;
    const hhmm = currentHHMM();
    if (hhmm < '17:25' || hhmm > '17:35') return;
    if (!guardCheck('timesheet_eod_' + todayKey(), 120)) return;
    await writeAlert(sb, {
      type: 'timesheet',
      title: 'Timesheet reminder',
      message: 'End of day — submit your timesheet before leaving.',
      renderer: 'timesheet',
      data: { links: [{ label: 'Open Freee', url: 'https://app.secure.freee.co.jp/' }] }
    });
  }

  // 7. Study nudge (language study at 18:30 weekday home)
  async function triggerStudyNudge(sb, location) {
    const cfg = (await loadConfig(sb)).study_nudge;
    if (!cfg?.enabled) return;
    if (!isWeekday() || location !== 'home') return;
    const hhmm = currentHHMM();
    if (hhmm < '18:25' || hhmm > '18:35') return;
    if (!guardCheck('study_nudge_' + todayKey(), 120)) return;
    await writeAlert(sb, {
      type: 'nudge',
      title: 'Language study time',
      message: cfg.nudge_message || 'Time to study — open your JLPT or Grammar app.',
      renderer: 'nudge'
    });
  }

  // --- Main evaluation loop (called by CC on its poll cycle) ---
  async function evaluate(sb, { lat, lng, jobcanStatus, checkoutLinks, checkinLinks }) {
    const location = detectLocation(lat, lng);

    // GPS-based triggers
    if (location === 'outside') {
      // Shop detection would be handled by CC's own shop proximity logic
      // triggerGpsShop is called separately when a specific shop is identified
    }

    // Office departure: was at office, now not
    // This is called by stack-ops handleLocationChange when location shifts FROM office
    // Not evaluated here — see stack-ops

    // Time-based triggers (always check)
    await triggerLunchTime(sb);
    await triggerDinnerTime(sb);
    await triggerTimesheetEOD(sb, location);
    await triggerStudyNudge(sb, location);
    await triggerMorningCheckin(sb, location, jobcanStatus?.checkedIn, checkinLinks);

    return { location };
  }

  return {
    evaluate,
    triggerGpsShop,
    triggerOfficeDeparture,
    triggerMorningCheckin,
    detectLocation,
    loadConfig,
    LOCATIONS,
  };
})();
