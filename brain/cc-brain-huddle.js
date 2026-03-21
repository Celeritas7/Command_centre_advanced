// =============================================
// CC Brain Huddle v2
// Provides brain-aware context for the morning huddle
// Reads all brain state and generates forecasts/insights
// =============================================

const CC_HUDDLE = (() => {

  // --- Build full brain context for huddle ---
  async function buildBrainHuddleContext(sb) {
    const [teamState, settings, activeBlockers, activeAlerts] = await Promise.all([
      sb.from('command_centre_active_team').select('*').eq('id', 'singleton').single().then(r => r.data),
      sb.from('command_centre_brain_settings').select('key, value').then(r => {
        const m = {};
        (r.data || []).forEach(row => m[row.key] = row.value);
        return m;
      }),
      sb.from('command_centre_blockers').select('*').eq('active', true).then(r => r.data || []),
      sb.from('command_centre_alerts').select('*').eq('active', true).then(r => r.data || []),
    ]);

    return {
      team: teamState,
      schedule: settings.schedule || {},
      overrides: settings.overrides || {},
      triggers: settings.triggers || {},
      blockers: activeBlockers,
      alerts: activeAlerts,
      timestamp: new Date().toISOString(),
    };
  }

  // --- Generate trigger forecast for today ---
  function generateTriggerForecast(ctx) {
    const triggers = ctx.triggers || {};
    const isWkday = new Date().getDay() >= 1 && new Date().getDay() <= 5;
    const location = ctx.team?.location || 'home';
    const hr = new Date().getHours();
    const forecast = [];

    for (const [key, cfg] of Object.entries(triggers)) {
      if (!cfg.enabled) continue;

      // Check day applicability
      if (cfg.days) {
        const dayOk = cfg.days.includes(isWkday ? 'weekday' : 'weekend');
        if (!dayOk) continue;
      }

      // Check location applicability
      if (cfg.location && cfg.location !== location) {
        // Might fire later if location changes
        forecast.push({
          trigger: key,
          status: 'conditional',
          condition: `If at ${cfg.location}`,
          time: cfg.time || 'GPS-based',
          description: cfg.description,
        });
        continue;
      }

      // Time-based: will it fire today?
      if (cfg.type === 'time' && cfg.time) {
        const [h] = cfg.time.split(':').map(Number);
        if (h > hr) {
          forecast.push({
            trigger: key,
            status: 'upcoming',
            time: cfg.time,
            description: cfg.description,
          });
        } else {
          forecast.push({
            trigger: key,
            status: 'passed',
            time: cfg.time,
            description: cfg.description,
          });
        }
        continue;
      }

      // GPS-based: depends on movement
      if (cfg.type === 'gps') {
        forecast.push({
          trigger: key,
          status: 'watching',
          time: 'GPS',
          description: cfg.description,
        });
      }
    }

    return forecast.sort((a, b) => {
      const order = { upcoming: 0, watching: 1, conditional: 2, passed: 3 };
      return (order[a.status] || 9) - (order[b.status] || 9);
    });
  }

  // --- Generate AI huddle v2 (prompt builder for Anthropic API call) ---
  function generateHuddleAI_v2(ctx, creditData, taskSummary) {
    const forecast = generateTriggerForecast(ctx);
    const isWkday = new Date().getDay() >= 1 && new Date().getDay() <= 5;
    const overrides = ctx.overrides || {};

    const prompt = `You are the Command Centre coach for Aniket's personal productivity system.
Current state:
- Day: ${isWkday ? 'Weekday' : 'Weekend'}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
- Location: ${ctx.team?.location || 'unknown'}
- Active team: ${ctx.team?.active_team || 'none'}
- Base team: ${ctx.team?.base_team || 'none'}
- Interrupt stack depth: ${(ctx.team?.interrupt_stack || []).length}
- Active blockers: ${ctx.blockers?.length || 0}
- Active alerts: ${ctx.alerts?.length || 0}

Credits: ${JSON.stringify(creditData || {})}
Tasks today: ${taskSummary || 'No summary available'}

Trigger forecast:
${forecast.map(f => `- ${f.trigger}: ${f.status} at ${f.time} — ${f.description}`).join('\n')}

Override status:
- Weekend shields up: ${overrides.weekend_shields_up?.enabled ? 'ON' : 'OFF'}
- Credit emergency: ${overrides.credit_emergency?.enabled ? 'ON (threshold: ' + (overrides.credit_emergency.threshold || 10) + ')' : 'OFF'}
- All-done shift: ${overrides.all_done_shift?.enabled ? 'ON' : 'OFF'}

Give a 3-4 line game plan for right now. Be specific about which team/task to focus on, warn about upcoming triggers, and note any override that's about to fire. Use the football pitch metaphor (attackers=career/coding, mid=food/exercise/grocery, defenders=fashion/sleep). Keep it punchy.`;

    return prompt;
  }

  // --- Render helpers for CC UI ---

  // Brain status bar (compact, fits in CC header area)
  function renderBrainStatusBar(ctx) {
    const team = ctx.team;
    const stackDepth = (team?.interrupt_stack || []).length;
    const blockerCount = ctx.blockers?.length || 0;
    const alertCount = ctx.alerts?.length || 0;

    return `
      <div class="brain-status-bar" style="display:flex;gap:12px;align-items:center;font-size:11px;padding:6px 12px;background:rgba(212,137,0,0.08);border-radius:8px;border:1px solid rgba(212,137,0,0.15)">
        <span style="color:#d48900;font-weight:600">🧠 ${team?.active_team || '—'}</span>
        <span style="color:#888">📍 ${team?.location || '?'}</span>
        ${stackDepth > 0 ? `<span style="color:#ff8c00">⚡ ${stackDepth} interrupt${stackDepth > 1 ? 's' : ''}</span>` : ''}
        ${blockerCount > 0 ? `<span style="color:#ff4444">🔒 ${blockerCount} blocker${blockerCount > 1 ? 's' : ''}</span>` : ''}
        ${alertCount > 0 ? `<span style="color:#d48900">🔔 ${alertCount} alert${alertCount > 1 ? 's' : ''}</span>` : ''}
      </div>`;
  }

  // Spotlight: current focus with context
  function renderSpotlight(ctx) {
    const team = ctx.team;
    const stack = team?.interrupt_stack || [];
    const resumeInfo = stack.length > 0
      ? `Will resume: ${stack[stack.length - 1].team}`
      : '';

    return `
      <div class="brain-spotlight" style="padding:16px;background:rgba(212,137,0,0.06);border-radius:12px;border:1px solid rgba(212,137,0,0.12);margin:8px 0">
        <div style="font-size:9px;letter-spacing:2px;color:#888;margin-bottom:4px">BRAIN SPOTLIGHT</div>
        <div style="font-size:18px;font-weight:700;color:#d48900">${team?.active_team || 'No active team'}</div>
        <div style="font-size:11px;color:#888;margin-top:4px">
          Base: ${team?.base_team || '—'} · Location: ${team?.location || '?'}
          ${stack.length > 0 ? ` · Stack: ${stack.length} deep` : ''}
        </div>
        ${resumeInfo ? `<div style="font-size:10px;color:#ff8c00;margin-top:4px">${resumeInfo}</div>` : ''}
      </div>`;
  }

  // Override warnings
  function renderOverrideWarnings(ctx) {
    const ov = ctx.overrides || {};
    const warnings = [];
    const isWkday = new Date().getDay() >= 1 && new Date().getDay() <= 5;
    const hr = new Date().getHours();

    if (!isWkday && ov.weekend_shields_up?.enabled && hr < (ov.weekend_shields_up.before_hour || 13)) {
      warnings.push('🛡️ Weekend shields up — defenders/mid before attackers until 1 PM');
    }

    if (warnings.length === 0) return '';

    return `
      <div style="margin:8px 0">
        ${warnings.map(w => `
          <div style="padding:8px 12px;background:rgba(255,140,0,0.1);border-left:3px solid #ff8c00;border-radius:4px;font-size:11px;color:#ff8c00;margin-bottom:4px">${w}</div>
        `).join('')}
      </div>`;
  }

  // Trigger forecast panel
  function renderTriggerForecast(ctx) {
    const forecast = generateTriggerForecast(ctx);
    if (forecast.length === 0) return '<div style="font-size:11px;color:#666">No triggers active today</div>';

    const statusIcon = { upcoming: '⏳', watching: '👁️', conditional: '❓', passed: '✅' };
    const statusColor = { upcoming: '#d48900', watching: '#4a9eff', conditional: '#888', passed: '#555' };

    return forecast.map(f => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px">
        <span>${statusIcon[f.status] || '•'}</span>
        <span style="color:${statusColor[f.status] || '#888'};min-width:50px">${f.time}</span>
        <span style="color:#c4baa8">${f.description}</span>
      </div>
    `).join('');
  }

  // Brain insight (for AI-generated section)
  function renderBrainInsight(insightText) {
    if (!insightText) return '';
    return `
      <div style="padding:12px;background:rgba(74,158,255,0.06);border-radius:10px;border:1px solid rgba(74,158,255,0.12);margin:8px 0">
        <div style="font-size:9px;letter-spacing:2px;color:#4a9eff;margin-bottom:6px">🤖 AI GAME PLAN</div>
        <div style="font-size:12px;line-height:1.6;color:#c4baa8">${insightText}</div>
      </div>`;
  }

  return {
    buildBrainHuddleContext,
    generateTriggerForecast,
    generateHuddleAI_v2,
    renderBrainStatusBar,
    renderSpotlight,
    renderOverrideWarnings,
    renderTriggerForecast,
    renderBrainInsight,
  };
})();
