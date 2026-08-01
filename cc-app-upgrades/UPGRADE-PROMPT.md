# Implementation prompt — Command Centre app upgrades: Squad Board + My Apps redesign + dockless navigation + radar boot splash

> Hand this file to a coding agent working in the Command Centre repo (the folder with
> `index.html`, ~5,700 lines, vanilla JS + Supabase). Four approved, prototyped upgrades.
> The visual reference prototypes are `SquadBoard.jsx.txt` and `MyApps.jsx.txt` (React
> source, copied next to this file) — they are the DESIGN SPEC ONLY; the app is vanilla
> JS string-built HTML, so port the look and interactions, do not import React.
> `dockless-prototype.html.txt` (also next to this file) is the reference for
> Upgrades 3 & 4 (top-bar layout, lone 🚨 styling, and the `Splash` component).

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

Radar splash:
- Shows on every full page load, radar spins, fades out after data load (≥1.2s),
- Uses theme vars so it matches whatever location theme loads first.

## Out of scope
- No Supabase schema changes (unless the owner opts into a priority column).
- No drag-to-reorder (later).
- Locker Room code stays (dead entry point is fine this pass).
