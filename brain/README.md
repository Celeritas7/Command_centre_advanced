# CC Brain — Module Reference

## Architecture

Command Centre is a **distributed operating system** using Supabase as a message bus.
CC (the brain) writes alerts/blockers → all 16 apps read and obey them.

```
CC writes → command_centre_blockers / command_centre_alerts / command_centre_active_team
                    ↓
        All apps poll every 60s
                    ↓
    Blockers freeze the screen
    Alerts show interactive overlays
```

## Modules

| File | Purpose | Runs in |
|------|---------|---------|
| `cc-brain-client.js` | Universal client snippet — polls, renders overlays | All 16 apps |
| `cc-brain-trigger-engine.js` | 7 triggers (GPS + time) → writes alerts/blockers | CC only |
| `cc-brain-stack-ops.js` | LIFO interrupt stack on command_centre_active_team | CC only |
| `cc-brain-scheduler.js` | Rigid schedule + 3 overrides → current team | CC only |
| `cc-brain-huddle.js` | Brain status, spotlight, forecast, AI insight | CC only |

## Client Modes

### Native mode (Project 1 apps — same Supabase)
```javascript
// App already has `sb` client pointing to CC's Supabase
CC_BRAIN.init({ mode: 'native', sb: sb });
```

### Dual mode (Project 2 language apps — separate Supabase)
```javascript
// App has its own `sb` for study data
// CC_BRAIN creates a second read-only connection to CC's Supabase
CC_BRAIN.init({ mode: 'dual' });
```

## Supabase Tables

| Table | Role |
|-------|------|
| `command_centre_blockers` | Full-screen locks (checkout, check-in) |
| `command_centre_alerts` | Overlay popups (cost, food, nudge, timesheet) |
| `command_centre_active_team` | Singleton: current team, LIFO stack, location |
| `command_centre_brain_settings` | Schedule, overrides, trigger configs (JSONB) |

## Built-in Renderers

1. **checkout** — Jobcan links, critical blocker
2. **timesheet** — Freee link, snooze-able
3. **cost_popup** — Amount input + memo, GPS-triggered
4. **food_reminder** — Checklist (fridge/cook/clean), snooze-able
5. **nudge** — Generic message, dismiss or snooze

## Trigger Reference

| # | Trigger | Type | When | Writes |
|---|---------|------|------|--------|
| 1 | GPS shop | GPS | Near a shop | Alert: cost_popup |
| 2 | Office departure | GPS | Left office, not checked out | Blocker: checkout |
| 3 | Lunch time | Time | 12:00 weekday | Alert: food_reminder |
| 4 | Dinner time | Time | 19:00 daily | Alert: food_reminder |
| 5 | Morning check-in | GPS | Arrive office, not checked in | Blocker: checkin |
| 6 | Timesheet EOD | Time | 17:30 weekday office | Alert: timesheet |
| 7 | Study nudge | Time | 18:30 weekday home | Alert: nudge |

## Override Rules

1. **Weekend shields up** — Before 1 PM on weekends, defender/mid teams take priority over attackers
2. **Credit emergency** — If any squad credits < 10, that squad gets forced to active
3. **All-done shift** — If all scheduled tasks done, shift to free time

## Key Design Decisions

- **Polling** (60s) over Supabase Realtime — simpler, good enough for GPS-triggered events
- **Any app dismisses** — the user handles alerts in whatever app they're in
- **Only CC writes** — apps are read-only clients, CC is the sole brain
- **Location change clears stack** — all interrupts reset when you move between home/office/outside
- **LIFO interrupt stack** — multiple interrupts nest properly, pop resumes the right context
