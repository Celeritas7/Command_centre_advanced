// =============================================
// CC Brain Client v2
// Paste into any app's <script> section
// Handles: blocker checks, alert checks, dismiss, snooze
// Modes: native (same sb) or dual (separate sb for Project 2 language apps)
// =============================================

const CC_BRAIN = (() => {
  // --- Configuration ---
  const CC_SB_URL = 'https://wylxvmkcrexwfpjpbhyy.supabase.co';
  const CC_SB_ANON = ''; // ← fill with CC project anon key
  const POLL_INTERVAL = 60000; // 60 seconds
  const APP_NAME = document.title || 'unknown_app';

  let ccSb = null;       // CC Supabase client (native or dual)
  let pollTimer = null;
  let currentBlocker = null;
  let currentAlert = null;

  // --- Renderer Registry ---
  // 5 built-in renderers; apps can register custom ones
  const renderers = {};

  function registerRenderer(name, fn) {
    renderers[name] = fn;
  }

  // --- Overlay DOM ---
  function ensureOverlayContainer() {
    if (document.getElementById('cc-brain-overlay')) return;
    const el = document.createElement('div');
    el.id = 'cc-brain-overlay';
    el.innerHTML = '';
    document.body.appendChild(el);

    const style = document.createElement('style');
    style.textContent = `
      #cc-brain-overlay { position:fixed; inset:0; z-index:99999; display:none; }
      #cc-brain-overlay.active { display:flex; align-items:center; justify-content:center; }
      .cc-blocker-bg { position:absolute; inset:0; background:rgba(0,0,0,0.92); }
      .cc-alert-bg { position:absolute; inset:0; background:rgba(0,0,0,0.7); }
      .cc-card {
        position:relative; z-index:1; background:#1a1a1a; border:1px solid #d4890033;
        border-radius:16px; padding:24px; max-width:380px; width:90%;
        color:#e8e0d4; font-family:'JetBrains Mono',monospace;
      }
      .cc-card-title {
        font-size:16px; font-weight:700; color:#d48900; margin-bottom:8px;
        display:flex; align-items:center; gap:8px;
      }
      .cc-card-msg { font-size:13px; line-height:1.6; color:#c4baa8; margin-bottom:16px; }
      .cc-card-actions { display:flex; gap:8px; flex-wrap:wrap; }
      .cc-btn {
        padding:8px 16px; border-radius:8px; border:none; cursor:pointer;
        font-family:inherit; font-size:12px; font-weight:600;
      }
      .cc-btn-primary { background:#d48900; color:#1a1a1a; }
      .cc-btn-secondary { background:#2a2a2a; color:#d48900; border:1px solid #d4890044; }
      .cc-btn-link {
        display:block; padding:10px 14px; background:#2a2a2a; border:1px solid #d4890022;
        border-radius:8px; color:#d48900; text-decoration:none; font-size:12px;
        margin-bottom:6px; text-align:center;
      }
      .cc-btn-link:hover { background:#333; }
      .cc-blocker-badge {
        display:inline-block; background:#ff4444; color:white; font-size:9px;
        padding:2px 6px; border-radius:4px; letter-spacing:1px; font-weight:700;
      }
      .cc-alert-badge {
        display:inline-block; background:#d48900; color:#1a1a1a; font-size:9px;
        padding:2px 6px; border-radius:4px; letter-spacing:1px; font-weight:700;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Built-in Renderers ---

  // 1. Checkout blocker (Jobcan links)
  registerRenderer('checkout', (item, overlay) => {
    const links = item.data?.links || [];
    let linksHtml = links.map(l =>
      `<a class="cc-btn-link" href="${l.url}" target="_blank">${l.label || l.url}</a>`
    ).join('');
    overlay.innerHTML = `
      <div class="cc-blocker-bg"></div>
      <div class="cc-card">
        <div class="cc-card-title"><span class="cc-blocker-badge">BLOCKER</span> ${item.message || 'Office checkout required'}</div>
        <div class="cc-card-msg">${item.data?.detail || 'Complete checkout before using any app.'}</div>
        ${linksHtml}
        <div class="cc-card-actions" style="margin-top:12px">
          <button class="cc-btn cc-btn-primary" onclick="CC_BRAIN.dismissBlocker('${item.id}')">Done — unlock apps</button>
        </div>
      </div>`;
  });

  // 2. Timesheet alert
  registerRenderer('timesheet', (item, overlay) => {
    const links = item.data?.links || [];
    let linksHtml = links.map(l =>
      `<a class="cc-btn-link" href="${l.url}" target="_blank">${l.label || 'Open timesheet'}</a>`
    ).join('');
    overlay.innerHTML = `
      <div class="cc-alert-bg"></div>
      <div class="cc-card">
        <div class="cc-card-title"><span class="cc-alert-badge">ALERT</span> ${item.title || 'Timesheet reminder'}</div>
        <div class="cc-card-msg">${item.message || 'Submit your timesheet before leaving.'}</div>
        ${linksHtml}
        <div class="cc-card-actions" style="margin-top:12px">
          <button class="cc-btn cc-btn-primary" onclick="CC_BRAIN.dismissAlert('${item.id}')">Done</button>
          <button class="cc-btn cc-btn-secondary" onclick="CC_BRAIN.snoozeAlert('${item.id}', 15)">Snooze 15m</button>
        </div>
      </div>`;
  });

  // 3. Cost popup (expense form)
  registerRenderer('cost_popup', (item, overlay) => {
    const shop = item.data?.shop || 'Unknown';
    const amount = item.data?.amount || '';
    overlay.innerHTML = `
      <div class="cc-alert-bg"></div>
      <div class="cc-card">
        <div class="cc-card-title"><span class="cc-alert-badge">COST</span> ${item.title || 'Log expense'}</div>
        <div class="cc-card-msg">Detected near <strong>${shop}</strong>. Log your expense:</div>
        <div style="margin-bottom:12px">
          <input id="cc-cost-amount" type="number" value="${amount}" placeholder="Amount (¥)"
            style="width:100%;padding:8px;background:#2a2a2a;border:1px solid #d4890033;border-radius:8px;color:#e8e0d4;font-family:inherit;font-size:14px;">
          <input id="cc-cost-memo" type="text" placeholder="Memo (optional)"
            style="width:100%;padding:8px;margin-top:6px;background:#2a2a2a;border:1px solid #d4890033;border-radius:8px;color:#e8e0d4;font-family:inherit;font-size:13px;">
        </div>
        <div class="cc-card-actions">
          <button class="cc-btn cc-btn-primary" onclick="CC_BRAIN.submitCost('${item.id}')">Log expense</button>
          <button class="cc-btn cc-btn-secondary" onclick="CC_BRAIN.dismissAlert('${item.id}')">Skip</button>
        </div>
      </div>`;
  });

  // 4. Food reminder (checklist)
  registerRenderer('food_reminder', (item, overlay) => {
    const tasks = item.data?.tasks || ['Check fridge', 'Plan meal', 'Start cooking'];
    let taskHtml = tasks.map((t, i) =>
      `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:#c4baa8;cursor:pointer">
        <input type="checkbox" id="cc-food-${i}" style="accent-color:#d48900"> ${t}
      </label>`
    ).join('');
    overlay.innerHTML = `
      <div class="cc-alert-bg"></div>
      <div class="cc-card">
        <div class="cc-card-title"><span class="cc-alert-badge">FOOD</span> ${item.title || 'Meal time'}</div>
        <div class="cc-card-msg">${item.message || 'Time to prepare your meal.'}</div>
        <div style="margin-bottom:12px">${taskHtml}</div>
        <div class="cc-card-actions">
          <button class="cc-btn cc-btn-primary" onclick="CC_BRAIN.dismissAlert('${item.id}')">Done</button>
          <button class="cc-btn cc-btn-secondary" onclick="CC_BRAIN.snoozeAlert('${item.id}', 30)">Snooze 30m</button>
        </div>
      </div>`;
  });

  // 5. Generic nudge
  registerRenderer('nudge', (item, overlay) => {
    overlay.innerHTML = `
      <div class="cc-alert-bg"></div>
      <div class="cc-card">
        <div class="cc-card-title"><span class="cc-alert-badge">NUDGE</span> ${item.title || 'Reminder'}</div>
        <div class="cc-card-msg">${item.message || 'Time to switch tasks.'}</div>
        <div class="cc-card-actions">
          <button class="cc-btn cc-btn-primary" onclick="CC_BRAIN.dismissAlert('${item.id}')">Got it</button>
          <button class="cc-btn cc-btn-secondary" onclick="CC_BRAIN.snoozeAlert('${item.id}', 10)">Snooze 10m</button>
        </div>
      </div>`;
  });

  // --- Core Logic ---

  async function init(options = {}) {
    // options.mode: 'native' (app uses CC's sb) or 'dual' (language app, separate sb)
    // options.sb: existing supabase client (for native mode)
    const mode = options.mode || 'native';

    if (mode === 'native' && options.sb) {
      ccSb = options.sb; // reuse app's own sb client
    } else if (mode === 'dual' || !options.sb) {
      // Create a dedicated read connection to CC's Supabase
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        ccSb = supabase.createClient(CC_SB_URL, CC_SB_ANON);
      } else {
        console.warn('[CC Brain] Supabase not loaded — client disabled');
        return;
      }
    }

    ensureOverlayContainer();
    await check();
    pollTimer = setInterval(check, POLL_INTERVAL);
    console.log(`[CC Brain] Initialized (${mode} mode) — polling every ${POLL_INTERVAL / 1000}s`);
  }

  async function check() {
    if (!ccSb) return;
    const overlay = document.getElementById('cc-brain-overlay');
    const now = new Date().toISOString();

    try {
      // 1. Check blockers first (highest priority)
      const { data: blockers } = await ccSb.from('command_centre_blockers')
        .select('*').eq('active', true).order('created_at', { ascending: false });

      if (blockers?.length) {
        currentBlocker = blockers[0];
        const renderer = renderers[currentBlocker.data?.renderer || currentBlocker.type] || renderers['nudge'];
        renderer(currentBlocker, overlay);
        overlay.classList.add('active');
        return;
      }

      // 2. Check alerts (skip snoozed)
      const { data: alerts } = await ccSb.from('command_centre_alerts')
        .select('*').eq('active', true).order('created_at', { ascending: false });

      const ready = (alerts || []).filter(a =>
        !a.snoozed_until || new Date(a.snoozed_until) <= new Date()
      );

      if (ready.length) {
        currentAlert = ready[0];
        const rendererName = currentAlert.renderer || currentAlert.type || 'nudge';
        const renderer = renderers[rendererName] || renderers['nudge'];
        renderer(currentAlert, overlay);
        overlay.classList.add('active');
        return;
      }

      // 3. Nothing active — hide overlay
      overlay.classList.remove('active');
      overlay.innerHTML = '';
      currentBlocker = null;
      currentAlert = null;

    } catch (err) {
      console.error('[CC Brain] Poll error:', err);
    }
  }

  async function dismissBlocker(id) {
    if (!ccSb) return;
    await ccSb.from('command_centre_blockers').update({
      active: false, dismissed_at: new Date().toISOString(), dismissed_by: APP_NAME
    }).eq('id', id);
    currentBlocker = null;
    await check();
  }

  async function dismissAlert(id) {
    if (!ccSb) return;
    await ccSb.from('command_centre_alerts').update({
      active: false, dismissed_at: new Date().toISOString(), dismissed_by: APP_NAME
    }).eq('id', id);
    currentAlert = null;
    await check();
  }

  async function snoozeAlert(id, minutes) {
    if (!ccSb) return;
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    await ccSb.from('command_centre_alerts').update({ snoozed_until: until }).eq('id', id);
    currentAlert = null;
    await check();
  }

  // Cost popup helper — logs expense then dismisses
  async function submitCost(alertId) {
    const amount = document.getElementById('cc-cost-amount')?.value;
    const memo = document.getElementById('cc-cost-memo')?.value;
    if (!amount) return;
    // Write to command_centre_alerts data for CC to pick up and route to Cost app
    if (ccSb) {
      await ccSb.from('command_centre_alerts').update({
        active: false,
        dismissed_at: new Date().toISOString(),
        dismissed_by: APP_NAME,
        data: { ...(currentAlert?.data || {}), logged_amount: Number(amount), logged_memo: memo }
      }).eq('id', alertId);
    }
    currentAlert = null;
    await check();
  }

  function destroy() {
    if (pollTimer) clearInterval(pollTimer);
    const overlay = document.getElementById('cc-brain-overlay');
    if (overlay) overlay.remove();
  }

  return {
    init, check, destroy,
    dismissBlocker, dismissAlert, snoozeAlert, submitCost,
    registerRenderer,
    get currentBlocker() { return currentBlocker; },
    get currentAlert() { return currentAlert; },
  };
})();
