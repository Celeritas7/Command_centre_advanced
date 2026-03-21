// =============================================
// CC Brain Stack Operations
// Manages the LIFO interrupt stack on command_centre_active_team
// Only CC writes to this table
// =============================================

const CC_STACK = (() => {

  // --- Read current state ---
  async function getState(sb) {
    const { data, error } = await sb.from('command_centre_active_team')
      .select('*').eq('id', 'singleton').single();
    if (error) { console.error('[CC Stack] Read error:', error); return null; }
    return data;
  }

  // --- Push: interrupt current team, push it onto stack ---
  async function stackPush(sb, { newTeam, reason, alertId }) {
    const state = await getState(sb);
    if (!state) return null;

    const stack = state.interrupt_stack || [];
    // Push current active team onto stack
    stack.push({
      team: state.active_team,
      reason: reason || 'interrupt',
      pushed_at: new Date().toISOString(),
      alert_id: alertId || null,
    });

    const { data, error } = await sb.from('command_centre_active_team').update({
      active_team: newTeam,
      interrupt_stack: stack,
    }).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] Push error:', error);
    return data;
  }

  // --- Pop: dismiss current interrupt, resume previous team ---
  async function stackPop(sb) {
    const state = await getState(sb);
    if (!state) return null;

    const stack = state.interrupt_stack || [];
    if (stack.length === 0) {
      // Nothing to pop — stay on base team
      return state;
    }

    const popped = stack.pop();
    const { data, error } = await sb.from('command_centre_active_team').update({
      active_team: popped.team,
      interrupt_stack: stack,
    }).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] Pop error:', error);
    return data;
  }

  // --- Pop specific team from stack (removes it wherever it is) ---
  async function stackPopTeam(sb, teamName) {
    const state = await getState(sb);
    if (!state) return null;

    let stack = state.interrupt_stack || [];
    const idx = stack.findIndex(s => s.team === teamName);
    if (idx === -1) return state;

    stack.splice(idx, 1);
    const { data, error } = await sb.from('command_centre_active_team').update({
      interrupt_stack: stack,
    }).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] PopTeam error:', error);
    return data;
  }

  // --- Clear: wipe stack, go back to base team ---
  async function stackClear(sb, { reason } = {}) {
    const state = await getState(sb);
    if (!state) return null;

    const { data, error } = await sb.from('command_centre_active_team').update({
      active_team: state.base_team,
      interrupt_stack: [],
    }).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] Clear error:', error);
    console.log(`[CC Stack] Cleared (reason: ${reason || 'manual'})`);
    return data;
  }

  // --- Set base team (the "home" state when nothing is interrupted) ---
  async function setBaseTeam(sb, teamName) {
    const state = await getState(sb);
    if (!state) return null;

    const update = { base_team: teamName };
    // If stack is empty, also update active team
    if (!state.interrupt_stack?.length) {
      update.active_team = teamName;
    }

    const { data, error } = await sb.from('command_centre_active_team')
      .update(update).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] SetBase error:', error);
    return data;
  }

  // --- Garbage collect: remove stale stack entries (> 2 hours old) ---
  async function stackGarbageCollect(sb) {
    const state = await getState(sb);
    if (!state) return null;

    const stack = state.interrupt_stack || [];
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const cleaned = stack.filter(s =>
      new Date(s.pushed_at).getTime() > twoHoursAgo
    );

    if (cleaned.length === stack.length) return state; // nothing to clean

    const { data, error } = await sb.from('command_centre_active_team').update({
      interrupt_stack: cleaned,
    }).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] GC error:', error);
    console.log(`[CC Stack] GC: removed ${stack.length - cleaned.length} stale entries`);
    return data;
  }

  // --- Handle location change: clear stack, update location ---
  async function handleLocationChange(sb, newLocation, prevLocation) {
    // Clear all interrupts on location change
    const { data, error } = await sb.from('command_centre_active_team').update({
      active_team: (await getState(sb))?.base_team || 'coding',
      interrupt_stack: [],
      location: newLocation,
      last_location_change: new Date().toISOString(),
    }).eq('id', 'singleton').select().single();

    if (error) console.error('[CC Stack] Location change error:', error);

    // Also clear all active alerts (they're location-specific)
    await sb.from('command_centre_alerts').update({ active: false, dismissed_by: 'location_change' })
      .eq('active', true);

    console.log(`[CC Stack] Location: ${prevLocation} → ${newLocation} — stack cleared`);

    // If leaving office, trigger departure check
    if (prevLocation === 'office' && newLocation !== 'office') {
      // This is where office_departure trigger fires
      // The trigger engine handles this via CC_TRIGGERS.triggerOfficeDeparture
    }

    return data;
  }

  // --- Update schedule slot (from scheduler) ---
  async function setScheduleSlot(sb, slotName) {
    const { data, error } = await sb.from('command_centre_active_team')
      .update({ schedule_slot: slotName })
      .eq('id', 'singleton').select().single();
    if (error) console.error('[CC Stack] SetSlot error:', error);
    return data;
  }

  return {
    getState,
    stackPush,
    stackPop,
    stackPopTeam,
    stackClear,
    setBaseTeam,
    stackGarbageCollect,
    handleLocationChange,
    setScheduleSlot,
  };
})();
