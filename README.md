# Command Centre

Personal life operating system. Single HTML app on GitHub Pages with Supabase backend.
Controls 16 apps via a message bus pattern — CC is the brain, all apps obey it.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Command Centre (the brain)                 │
│  Scheduler → Triggers → Stack Ops → Huddle  │
│  Writes to: command_centre_blockers, command_centre_alerts,         │
│             command_centre_active_team, command_centre_brain_settings│
└────────────────────┬────────────────────────┘
                     │ writes
          ┌──────────▼──────────┐
          │  Supabase (CC)      │
          │  Message Bus        │
          └──────────┬──────────┘
                     │ reads (poll 60s)
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 Project 1       Project 1       Project 2
 9 apps          (native sb)     7 language apps
 Calendar        Cost, Food...   (dual sb)
 Eagle Eye       Ghost, Parts    JLPT, Burmese
                 Code Sensei     Grammar, etc.
```

## Repo Structure

```
command-centre/
├── index.html                     ← CC app (GitHub Pages)
├── brain/
│   ├── cc-brain-client.js         ← universal client (all apps)
│   ├── cc-brain-trigger-engine.js ← 7 triggers (CC only)
│   ├── cc-brain-stack-ops.js      ← LIFO interrupt stack (CC only)
│   ├── cc-brain-scheduler.js      ← schedule + overrides (CC only)
│   ├── cc-brain-huddle.js         ← status/forecast/AI (CC only)
│   └── README.md
├── sql/
│   ├── 01-blockers-alerts.sql     ← command_centre_blockers + command_centre_alerts
│   ├── 02-active-team.sql         ← command_centre_active_team (LIFO stack)
│   └── 03-settings.sql            ← command_centre_brain_settings + seed data
└── README.md                      ← this file
```

## Setup

### 1. Run SQL schemas

In Supabase SQL Editor (https://wylxvmkcrexwfpjpbhyy.supabase.co):

```
Run sql/01-blockers-alerts.sql
Run sql/02-active-team.sql
Run sql/03-settings.sql
```

### 2. Set anon key

In `brain/cc-brain-client.js`, fill `CC_SB_ANON` with your project's anon key.

### 3. Deploy

Push to GitHub → GitHub Pages serves `index.html` at the root.

## Integration Roadmap

| Step | What | Status |
|------|------|--------|
| 1 | Create repo, push structure | ⬜ |
| 2 | Run SQL schemas on Supabase | ⬜ |
| 3 | Embed brain client in CC index.html | ⬜ |
| 4 | Wire trigger engine to CC's existing GPS/time checks | ⬜ |
| 5 | Wire stack ops to CC's team management | ⬜ |
| 6 | Wire scheduler to CC's existing schedule display | ⬜ |
| 7 | Build settings UI (3-tab panel) in CC | ⬜ |
| 8 | Add client snippet to Calendar app (first external) | ⬜ |
| 9 | Roll out to remaining 8 Project 1 apps | ⬜ |
| 10 | Roll out to 7 Project 2 language apps (dual-sb) | ⬜ |

## GPS Coords

| Location | Lat | Lng | Radius |
|----------|-----|-----|--------|
| Home | 35.7089 | 139.9454 | 500m |
| Office | 35.5791 | 139.7485 | 500m |

## CC Supabase

URL: `https://wylxvmkcrexwfpjpbhyy.supabase.co`

## License

Private — personal use only.
