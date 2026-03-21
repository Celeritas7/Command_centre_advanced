// =============================================
// CC Brain Scheduler v2
// Hybrid: rigid skeleton + 3 overrides
// Reads schedule/overrides from command_centre_brain_settings (5-min cache)
// Outputs: which team should be active right now
// =============================================

const CC_SCHEDULER = (() => {
  // --- Cache ---
  let scheduleCache = null;
  let overridesCache = null;
  let cacheLoadedAt = 0;
  const CACHE_TTL = 5 * 60 * 1000; // 5 min

  // --- Load from Supabase ---
  async function loadSettings(sb) {
    if (scheduleCache && overridesCache && (Date.now() - cacheLoadedAt) < CACHE_TTL) {
      return { schedule: scheduleCache, overrides: overridesCache };
    }
    try {
      const { data } = await sb.from('command_centre_brain_settings')
        .select('key, value')
        .in('key', ['schedule', 'overrides']);
      for (const row of (data || [])) {
        if (row.key === 'schedule') scheduleCache = row.value;
        if (row.key === 'overrides') overridesCache = row.value;
      }
      cacheLoadedAt = Date.now();
    } catch (e) {
      console.warn('[CC Scheduler] Settings load failed:', e);
    }
    return { schedule: scheduleCache || {}, overrides: overridesCache || {} };
  }

  // --- Helpers ---
  function isWeekday() {
    const d = new Date().getDay();
    return d >= 1 && d <= 5;
  }

  function currentHour() {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  function timeToHour(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h + m / 60;
  }

  // --- Core: resolve current slot from rigid skeleton ---
  function resolveSlot(schedule, location) {
    const dayType = isWeekday() ? 'weekday' : 'weekend';
    const daySchedule = schedule[dayType];
    if (!daySchedule) return null;

    const hr = currentHour();

    // Try location-specific schedule keys
    const candidates = [];
    if (dayType === 'weekday') {
      if (location === 'home' && hr < 9) candidates.push('home_morning');
      if (location === 'office') candidates.push('office');
      if (location === 'home' && hr >= 17) candidates.push('home_evening');
      // Fallback: try all weekday sub-schedules
      candidates.push('home_morning', 'office', 'home_evening');
    } else {
      candidates.push('home');
    }

    for (const key of candidates) {
      const slots = daySchedule[key];
      if (!slots) continue;
      for (const slot of slots) {
        const from = timeToHour(slot.from);
        const to = timeToHour(slot.to);
        if (hr >= from && hr < to) {
          return { team: slot.team, slotName: `${dayType}.${key}.${slot.from}` };
        }
      }
    }

    return null; // no matching slot — free time
  }

  // --- Override 1: Weekend shields up ---
  // Before 1 PM on weekends, force defender/mid tasks before attackers
  function applyWeekendShieldsUp(overrides, resolvedTeam) {
    const cfg = overrides.weekend_shields_up;
    if (!cfg?.enabled) return resolvedTeam;
    if (isWeekday()) return resolvedTeam;
    if (currentHour() >= (cfg.before_hour || 13)) return resolvedTeam;

    const forcedTeams = cfg.forced_teams || ['defender', 'mid'];
    // If the resolved team is an attacker-type, override to defender_mid
    const attackerTeams = ['coding', 'language_study', 'mechanical', 'career'];
    if (attackerTeams.includes(resolvedTeam)) {
      return 'defender_mid'; // force defender/mid priority
    }
    return resolvedTeam;
  }

  // --- Override 2: Credit emergency ---
  // If any squad credits < threshold, force that squad
  function applyCreditEmergency(overrides, resolvedTeam, creditData) {
    const cfg = overrides.credit_emergency;
    if (!cfg?.enabled || !creditData) return resolvedTeam;
    const threshold = cfg.threshold || 10;

    for (const [squad, credits] of Object.entries(creditData)) {
      if (credits < threshold) {
        console.log(`[CC Scheduler] Credit emergency: ${squad} at ${credits} credits`);
        return squad; // force this squad
      }
    }
    return resolvedTeam;
  }

  // --- Override 3: All-done shift ---
  // If all scheduled tasks for current slot are done, shift to free/next
  function applyAllDoneShift(overrides, resolvedTeam, allTasksDone) {
    const cfg = overrides.all_done_shift;
    if (!cfg?.enabled) return resolvedTeam;
    if (!allTasksDone) return resolvedTeam;

    return cfg.fallback_team || 'free';
  }

  // --- Main: get what team should be active right now ---
  async function getCurrentTeam(sb, { location, creditData, allTasksDone } = {}) {
    const { schedule, overrides } = await loadSettings(sb);

    // 1. Resolve from rigid skeleton
    const slot = resolveSlot(schedule, location || 'home');
    let team = slot?.team || 'free';
    const slotName = slot?.slotName || 'none';

    // 2. Apply overrides in priority order
    team = applyWeekendShieldsUp(overrides, team);
    team = applyCreditEmergency(overrides, team, creditData);
    team = applyAllDoneShift(overrides, team, allTasksDone);

    return { team, slotName, overridesApplied: team !== (slot?.team || 'free') };
  }

  // --- Invalidate cache (for settings UI to call after save) ---
  function invalidateCache() {
    cacheLoadedAt = 0;
    scheduleCache = null;
    overridesCache = null;
  }

  return {
    getCurrentTeam,
    resolveSlot,
    loadSettings,
    invalidateCache,
  };
})();
