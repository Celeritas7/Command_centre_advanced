# Implementation prompt — Command Centre app upgrades: Squad Board + My Apps redesign + dockless navigation + radar boot splash + Day Plans redesign

> Hand this file to a coding agent working in the Command Centre repo (the folder with
> `index.html`, ~5,700 lines, vanilla JS + Supabase). Five approved, prototyped upgrades.
> The visual reference prototypes are `SquadBoard.jsx.txt` and `MyApps.jsx.txt` (React
> source, copied next to this file) — they are the DESIGN SPEC ONLY; the app is vanilla
> JS string-built HTML, so port the look and interactions, do not import React.
> `dockless-prototype.html.txt` (also next to this file) is the reference for
> Upgrades 3 & 4 (top-bar layout, lone 🚨 styling, and the `Splash` component).
> `day-plans-redesign.html.txt` is the reference for Upgrade 5 — it is vanilla JS
> using manager.html's exact class names and tokens, so it ports nearly 1:1.

---

## Ground rules (both upgrades)

- Everything lives in `index.html`, same style as existing code: string-built HTML,
  inline `onclick`, `esc()` for user text, state in globals, persistence via
  `memSave('cf_…', JSON.stringify(...))` into `mind_map_app_chat_memory`.
- Reuse the existing theme vars (`--bg --card --accent --as --text --text2`) so both
  screens re-theme with Home/Office/Outside like everything else.
- Squad colors (match prototype + existing pitch): attacker `#DC2626`, midfielder
  `#D97706`, defender `#7C3AED`. Priority traffic light: High `#DC2626`,
  Med `#D97706`, Low `#16A34A`.
- Don't break: `openAppLaunch` button wiring (`#appLaunchBtn`), the delete-confirm
  popup (`delPopup`/`alAskDel`), edit snapshot/cancel behavior, app order rules
  (`getOrderedAppDB`, `matchAppOrderRule`), Supabase load in the `cf_*` batch (line
  ~2590) — new keys must be added to that `.in('key',[…])` list.

---

## Upgrade 1 — Squad Board (new overlay screen)

A team-sheet view of ALL players (categories) at once, divided into three vertical
columns on the pitch — ⚔️ Attackers | 🏃 Midfield | 🪞 Defenders — from which tasks
are assigned per player. Opens from a new button next to `#appLaunchBtn` (icon: 3
columns), and replaces the Locker Room list as the primary "see the whole squad" view
(keep the Locker Room code; just point its entry button at the Squad Board).

### Data mapping (real model, not the prototype's seed)

- **Player** = a category: every entry of `SQUADS` (13 built-ins) plus `customSquads`
  keys, resolved through `squadName()`/`squadDef()`. Column = `type`
  (attacker/midfielder/defender).
- **Player's tasks** = tasks in `allTasks` whose tag (via `mind_map_app_task_tags` →
  `mind_map_app_tags`, already loaded at startup ~line 2586) maps to that category,
  status ≠ `done`. Count badge = that number.
- **Assign task** = the existing `createTask(name, categoryName)` (used by
  `addTaskToCat`, ~line 4397) — it inserts into `mind_map_app_tasks` and links the tag.
- **Location awareness**: dim (opacity .55) players not in the current `loc`
  (`isSquadInLoc(cat,loc)`) instead of hiding them — the board shows the WHOLE squad.

### Layout (port from SquadBoard.jsx)

- Full-screen overlay (same pattern as `appLaunchOv`), sticky header: Fraunces title
  "Squad Board", hint "Tap a player to assign", ✕ close.
- Legend row: colored dot + squad name per column; append " · on the ball" to the
  squad type currently in possession (reuse the possession/phase state the pitch uses).
- The pitch: green gradient field (reuse the pitch CSS) with a 3-column grid;
  dashed white column dividers (`1.5px dashed rgba(255,255,255,.3)`).
- Column header: solid pill in squad color — `icon NAME · count` (+ ` ●` when on the
  ball), `white-space:nowrap`, plus a small white `+` circle = add player (new custom
  category → existing custom-squad flow, `cf_custom_squads`).
- Players in a **2-wide grid per column** (`grid-template-columns:repeat(2,minmax(0,1fr))`),
  each marker: 40px white circle, 2.5px squad-color border, category emoji (see below),
  count badge top-right (16px, squad color, white 2px border), name plate under it
  (9px bold white on `rgba(0,0,0,.38)`, rounded 7px, ellipsis at full cell width).
- Player icons: reuse `playerMap` / the emoji already used for dots on the pitch;
  fall back to the squad-type icon.

### Assignment sheet (tap a player; port from SBAssign)

- Bottom-sheet overlay above the board (existing `.ov-panel` pattern), title = icon
  circle in squad color + player name; below it: squad badge, task count, and a
  **Bench** toggle (right-aligned, `white-space:nowrap`).
- Soft-tinted "＋ ASSIGN TO {NAME}" card: text input + squad-color **Assign** button
  (Enter also submits, input refocuses after add);
  - **Rule chips**: `One-off · Daily · Weekdays · Weekly` (selected = filled squad
    color, `white-space:nowrap`). One-off → plain `createTask`. Daily/Weekdays/Weekly
    → ALSO register in the existing regen system (`cf_regen_tasks`) so it recurs —
    follow whatever shape `regenTasks` entries already have; if Weekdays isn't
    representable there, flag it and fall back to Daily with a `(weekdays)` note.
  - **Priority chips**: High/Med/Low in traffic-light colors. `mind_map_app_tasks`
    has no priority column — store per-task priority in a new memory key
    `cf_task_priority` (`{taskId:'High'|'Med'|'Low'}`), and use it to order the
    task list in this sheet (High first). **Decision point:** if the owner prefers a
    DB column, ask before adding one.
- Below: the player's open tasks as checkable rows (check = `markDone(id)`), meta line
  = rule + priority. Empty state: "No tasks yet — assign the first above."
- **Bench** = new memory key `cf_benched` (`{categoryName:true}`). Benched player:
  grayscale + 55% opacity marker with a "BENCH" tag instead of the count, assign card
  disabled, and — on the main pitch — `renderPitch` must skip benched categories
  (this is the one integration into existing rendering; keep it a one-line filter).

---

## Upgrade 2 — My Apps redesign (rewrite `openAppLaunch` rendering)

Keep ALL existing state and plumbing: `appDB` (categories with `apps` and `subs`),
`alEditMode`, `alSnapshot` cancel-on-close, `alFilter`, `saveAppDB()`,
`alAskDel`/`delPopup`, `getOrderedAppDB()`/`matchAppOrderRule()` view ordering,
`alAddCategory()`. Only the rendering + interactions change (port from MyApps.jsx):

- **Sticky header**: "My Apps" + `active / total active` pill + **✎ Edit / ✓ Done**
  toggle (same snapshot semantics as `alToggleEditMode`) + ✕ close. Second row:
  **search input** (filters app names live, case-insensitive, both modes — new
  global `alQuery`, reset on close) + filter chips **All / Active / Off** (now
  available in BOTH modes, not just edit mode).
- **Launch-first grid** (view mode): the whole sheet is one flow of group sections —
  NO fixed narrow column; each group renders a full-width section:
  - Group header: 10px uppercase letter-spaced name in the group's color, 2px bottom
    rule in `color+'33'`, `on/total` count; **subgroups (`subs`) become small outline
    chips on the header row** — their apps merge into the group's grid (tile keeps a
    tiny sub tag) — no more nested boxes.
  - Tiles: `grid-template-columns:repeat(auto-fill,minmax(68px,1fr))`, gap `12px 6px`.
    Tile = 54px rounded-16 icon button (emoji or existing ico), status dot bottom-right
    (green active / grey inactive), 9px name under it (ellipsis). Inactive: 45%
    opacity + grayscale. Tap = `window.open(url)` (apps without URL: no-op cursor).
  - Group colors: assign a stable palette (blue `#3B5BDB`, green `#38A169`, orange
    `#E8722A`, purple `#7C3AED`, cycling by index) — appDB has no color field; store
    nothing, derive by index.
- **Edit mode**: same grid, but tap tile = toggle `active`; tap name = inline rename
  (swap to input, Enter/blur commits); × badge top-left = `alAskDel` (existing confirm
  popup); dashed "＋ App" button on each group header (one prompt-less inline row:
  name + URL inputs + add); dashed full-width "＋ New group" at the bottom
  (`alAddCategory`). Keep icon/URL editing from the current edit UI wherever it exists
  today — reachable from the tile (e.g. long-press or a small ✎ on the tile), don't drop it.
- Keep the order-rule footer ("📐 Order: …") in view mode.
- Delete the now-unused old rendering helpers (`alRenderColNormal`, `alRenderColEdit`,
  `.al-col*` CSS) only after everything works.

---

## Upgrade 3 — Dockless navigation (approved layout)

The floating corner buttons / any bottom dock are replaced by this final arrangement —
one control per job, nothing overlapping the pitch:

- **Top bar** (title row) gains square 36px buttons (`background:var(--as)`,
  `border-radius:10px`), left of the existing 🚃 trains button:
  - **Apps** (4-square grid icon, stroke 2.2 line SVG) → opens My Apps (`openAppLaunch`).
  - **⚙️ Manager settings** → opens the existing settings overlay.
  Remove their old floating/corner equivalents.
- **Squad Board opens from the COACH dot on the pitch** — make the coach marker
  tappable (`onclick` → open Squad Board). No dedicated toolbar button. Keep the
  coach-briefing pill/strip behavior separate if it exists; the dot itself = squad.
- **Quick capture** = the dashed "Add a task or rule…" bar rendered on the pitch home
  under the possession strip (26px accent + icon, label, "Quick capture" hint).
  Remove any floating ＋ FAB.
- **🚨 Emergency** is the ONLY floating control: fixed bottom-right (16px inset),
  48px circle, `background:var(--card)` + `1.5px solid var(--as)` idle; armed =
  solid `#DC2626` with `0 0 0 4px rgba(220,38,38,.22)` ring glow. `transition:all .2s`.
- **No Kickoff button anywhere** — the Morning Kickoff lock screen is triggered only
  by the autogenerated morning message, never manually.

## Upgrade 4 — Radar boot splash

A once-per-load splash over the app while it boots (also covers the Supabase initial
load nicely). Port from the `Splash` component in `dockless-prototype.html`:

- Full-viewport overlay, `background:var(--bg)`, z-index above everything.
- Center: 120px stage with the **line-drawn radar mark** (inline SVG, 88px): orange
  `#D95D39` lattice dish + feed horn, neutral `var(--text)` tower/base. The **dish
  assembly rotates continuously** — wrap dish+horn+mast in a `<g>` with
  `transform-origin` at the tower top and `animation: spin 2.4s linear infinite`
  (`@keyframes` 0→360deg). Tower/base static.
- Two expanding ping rings behind it: 2px `var(--accent)` circles animating
  `scale(.4)→scale(1.5)` + fade, 1.6s ease-out infinite, second delayed .8s.
- Below: "Command Centre" (Fraunces 20px/700) + "SCANNING THE PITCH…" (10px, 700,
  2px letter-spacing, uppercase, `var(--text2)`).
- Dismiss: fade out (.5s) once initial data load resolves, minimum display ~1.2s so
  it never just flashes; remove from DOM after fade. No splash on soft re-renders.

## Upgrade 5 — Day Plans page redesign (manager.html)

This one targets **`manager.html`**, not index.html: replace `pgDayPlans()` and
`renderDayTimeline()` with the versions in `day-plans-redesign.html.txt`. Keep the
existing `dayPlans` data shape, `saveDayPlans()`, `SQUADS`, `findSq()`, and preset
definitions — the reference file stubs those; port only the rendering + interaction
logic and the new CSS classes (`.int-row`, `.int-editor`, `.lock-badge`, `.tl-tick`,
`.clash-note`, `.clash-card`, `.clash-cols`, `.clash-col`, `.clash-task`,
`.confirm-wrap`, `.confirm-box`, `.undo-toast`, updated `.tl-*` sizes).

What changes:
1. **Collapsed interrupt rows** — each interrupt is a 44px summary row (time · icon ·
   squad · duration · task count · lock badge · chevron). Tap expands ONE editor at a
   time (`openInt` id state); the editor holds time/squad/duration inputs + checklist
   + remove. The lock badge itself toggles hard/soft (stopPropagation — no separate
   toggle button). No always-open config rows.
2. **Legible timeline** — hour labels 10px `var(--text2)`; bar labels 9px JetBrains
   Mono; interrupts too narrow for text (<~4.7% width) render as a 6px color tick
   (`.tl-tick`) with full info in `title`. ONE now-line overlay positioned over the
   whole timeline body (`left:calc(60px + (100% - 60px) * fraction)`), not one per row.
3. **Preset confirm + undo** — preset buttons open a confirm dialog stating what will
   be replaced; on apply, snapshot the old plan and show an 8s undo toast that
   restores it. Presets never wipe silently.
4. **Empty state** — when a day type has zero interrupts: hide the timeline and
   interrupt list, show a centered card with preset buttons ("Start from a preset")
   and a ghost "+ Or add a single interrupt" button.
5. **Overlap handling** — detect overlapping [start, start+duration) ranges. Clashing
   bars/ticks get a red outline (`.clash` class); a note appears plus a **clash
   resolver card** per overlap cluster: the time window, one column per competing
   interrupt (squad, 🔴 P1 · HARD first then 🟡 Pn · SOFT, time · duration, and the
   FULL checklist) so the user can choose what to do in that window.
6. Minor: tab labels carry interrupt counts ("📅 Weekday · 6"); new interrupts default
   to `SQUADS[0].name` (not hardcoded 'Food') and open their editor immediately;
   duration options gain 90 and 120; `white-space:nowrap` on `.mgr-btn`/`.lock-badge`.

Acceptance criteria:
- Six interrupts render as six one-line rows; expanding one collapses any other.
- Lock badge toggles hard/soft directly from the collapsed row.
- A 10–15min interrupt shows as a tick, never clipped text; tooltip has full info.
- Applying a preset asks first and offers undo for ~8s; undo restores exactly.
- Empty day type shows the preset empty state, no empty timeline.
- Two overlapping interrupts produce red outlines + a resolver card listing both
  checklists with priority badges.
- Existing Supabase persistence (`saveDayPlans`) and the index.html interrupt
  scheduler (`dpCheckInterrupts`) keep working unchanged.

### Trigger Engine + Clash Rules — DECLINED TWICE

> **Audited 2026-08-02 as a restore; re-proposed 2026-08-05 as net-new.
> Declined both times — do not re-open, do not implement.**
>
> **As a restore, there is nothing to restore.** Neither card has ever existed in this
> repo. `git log --all -S"Trigger Engine"` and `-S"Clash Rules"` over `manager.html`
> return nothing, back to the file's first commit `01ac33b`; pre-upgrade `pgDayPlans()`
> (`12d9f6f`) ends at the Quick Presets card and returns. The strings "Morning Kickoff
> 07:00", "Lunch Break 12:00", "Defenders' 20:00" and "sleep gate is absolute" appear
> nowhere in the repo. There is no prior markup, class, or handler to restore verbatim.
>
> **As net-new work, declined on three grounds:**
> - `pgBrain()` already owns this. Clash resolution lives there (🏆 Priority Tiers,
>   ⚙️ Override Rules — which renders `clashRules.weekendShieldsUp`, i.e. "Weekend
>   shields" — ⚡ Clash Simulator, ⚠️ Active Clashes), backed by `clashPriorities` /
>   `clashRules` / `saveClash()` / `resolveClash()`. A second surface editing the same
>   state is a duplicate, not a feature.
> - The three time-lock pills have no backing enable/disable flag anywhere in the app,
>   so they could only ever render display-only. The proposal concedes this ("don't
>   invent state") — which leaves a card whose only live control is the one toggle
>   `pgBrain()` already has.
> - No markup is available. The proposal cites `ui_kits/manager/index.html` and
>   `Manager.jsx` in a separate design-system project; neither is in this repo.
>
> The real trigger systems are `gpsTriggers` (rendered by `pgCommute()` ⚡ Triggers,
> engine in `index.html` `gpsCheckTriggers()`) and `costTriggerCfg.timeTriggers`
> (`pgSettings` 💰 Smart Expense Triggers) — neither is a Day Plans concern.

### Amendment (v2): My Apps grouped by squad → category

My Apps is now organized in two levels: top-level **squad sections** (⚔️ Attackers ·
🏃 Midfielders · 🪞 Defenders — squad-colored banner with icon, sub-line, active
count, and "+ Category" in edit mode), each containing **category groups**
(e.g. under Attackers: Language Study → JP Grammar, JLPT, Chinese, Scriptura;
Finance → Cost Management, Investment; Career → Roadmap, writing_test). Categories
keep their own accent color and "+ App"; the two Language Study (JA/CN) groups merge
into one category. Search/filter hides empty categories and squads. Reference:
`ui_kits/command_centre/MyApps.jsx` (v2).

### Amendment (v3): Radar boot splash — night-ops scope

Replace the light splash with a dark high-stakes radar scope (reference: `Splash()`
in `ui_kits/command_centre/dockless-prototype.html`):
- Full dark backdrop (radial #221B15 → #12100D) with a faint horizontal scanline
  drifting down.
- 200px radar scope: accent-orange rim with outer glow, 3 concentric rings,
  crosshairs, a rotating conic sweep beam (2s/rev, bright #FFB27A leading edge),
  4 blips that pop and fade as the beam passes, glowing center dot, and two
  expanding ping rings.
- Title "Command Centre" in display font, warm-white with orange glow; below it a
  status ticker cycling every 1s: "Scanning the pitch…" → "Squads located" →
  "Possession mapped", with a 3-segment progress bar.
- Total run ~3.4s: fade-out begins at 2.85s.

## Acceptance criteria

Squad Board:
- Opens from the new toolbar button; shows every built-in + custom category in the
  correct column with live open-task counts; players outside the current location
  render dimmed, never hidden.
- Assigning with rule One-off creates a normal task visible on the pitch after
  `renderPitch`; Daily/Weekly tasks also appear in the regen config.
- Priority persists across reload (`cf_task_priority` in the startup `cf_*` batch).
- Benching a player hides it from the pitch and survives reload (`cf_benched`);
  un-benching restores it.
- Checking a task in the sheet calls `markDone` and the count badge updates.

My Apps:
- View mode: full-width grid, tap opens the app URL; search narrows instantly;
  All/Active/Off chips work in both modes.
- Edit mode: toggle/rename/delete/add app/add group all work; ✕ close cancels edits
  (snapshot restore), ✓ Done saves via `saveAppDB()`.
- Order rules still apply in view mode; nothing else in the app regresses
  (dock "My Apps" in office view, blocker screens, settings untouched).
- Both screens re-theme correctly across Home/Office/Outside.

Dockless navigation:
- Apps + ⚙️ live in the top bar; Squad opens from the coach dot; quick-add bar on the
  pitch opens capture; 🚨 is the only floating button and toggles emergency mode.
- No dock, no corner FABs, no Kickoff button remain; nothing overlaps the pitch or
  the coach dot.

Radar splash (v3 night-ops scope — supersedes the original U4 criteria):
- Shows on every full page load; the sweep beam rotates, blips pop as it passes, and
  the status ticker runs Scanning the pitch… → Squads located → Possession mapped.
- Fades once the initial data load resolves but never before ~2.85s (the full boot
  sequence), ~3.4s total including the .55s fade.
- One exception: the sleep-gate path calls `dismissSplash(true)`, which cuts the
  minimum to ~400ms. That path loads no data and only has to reach the lock screen,
  so holding the scope there is dead time.
- **Deliberately unthemed — do not re-open as a theming bug.** The v3 scope is fixed
  dark (`#101B14`→`#0A120D`, green `#4ADE80`) exactly as the prototype specifies, and
  does NOT read the theme vars. This replaces the original U4 line "uses theme vars so
  it matches whatever location theme loads first", which no longer applies.

## Out of scope
- No Supabase schema changes (unless the owner opts into a priority column).
- No drag-to-reorder (later).
- Locker Room code stays (dead entry point is fine this pass).
