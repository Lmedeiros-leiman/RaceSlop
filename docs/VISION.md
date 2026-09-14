# RaceSlop — Vision

Status: draft
Date: 2026-09-14

## 1. Overview

RaceSlop is a singleplayer 3D kart racer for the web, inspired by Mario Kart.

The core bet: kart racing feels great even without items or multiplayer, if drifting, speed, and track readability are right. We build that core first.

Solo time-trial is the game. Everything else serves it.

## 2. The 30-second fantasy

You launch from the start line. You hold acceleration into the first sweeper, flick into a drift, hold the angle, release for a boost, and cross the line thinking: "one more lap, I can take that corner faster."

Fast to start, hard to perfect. No menus in the way, no waiting.

## 3. Design pillars

1. **Flow over simulation.** Arcade handling. Predictable, forgiving, fun at full speed.
2. **Readable at speed.** Wide tracks, clear corners, high-contrast edges. You always know where to go.
3. **Drift is the game.** One drift mechanic with real depth: angle control, timing, boost reward.
4. **Chase yourself.** Lap times, best laps, and ghosts over opponents for now.
5. **Light and fast.** Low-poly 3D, 60fps on typical desktop hardware, instant load in the browser.

## 4. Game modes

### MVP: Solo time-trial (locked)

- 1 driver on track
- 3-2-1 countdown, flying or standing start (TBD in spec)
- Best lap + total time tracking
- Restart instantly, zero friction
- No bots, no items, no collisions with opponents

### Post-MVP: Race vs bots

- 3–7 bots, simple rubber-banding
- Same tracks, same karts, grid start
- Still no items in the first iteration

### Out of vision for now

Items, pickups, multiplayer, career mode, kart customization, mobile touch controls.

## 5. Core mechanics

- **Drive:** accelerate, brake, steer. Automatic forward acceleration model with keyboard throttle (details in spec).
- **Drift:** the signature move. Initiate on corner entry, hold angle with steering, release for a small boost. Available from day one.
- **Boost:** earned from clean drift releases. Short, punchy, not race-breaking.
- **Off-track:** slowdown surfaces (grass, sand) punish wide lines without hard walls everywhere.
- **Timer:** current lap, last lap, best lap. Always visible, always honest.

What we deliberately skip in MVP: jumps, tricks, slipstreams, items, damage.

## 6. Characters (roster of 4)

The milestone is 4 characters.

For this phase, characters are **reskins**: distinct silhouette, color, and personality on a shared base kart with identical handling. This keeps the roster readable and the balancing trivial while we prove the driving core.

Character slots (names and looks TBD):

1. Balanced rookie — the default, friendly and readable
2. Heavy bruiser — visually bulkier, same stats for now
3. Light nimble — visually smaller, same stats for now
4. Wildcard — distinct theme to test art range

Future intent (not MVP): differentiate with speed / acceleration / handling stats.

A character counts when it has a distinct low-poly model + palette visible in-game and on the select screen.

## 7. Tracks (set of 4)

The milestone is 4 tracks.

Each track is a distinct layout + visual theme. Design goals for all four: readable corners, a rhythm of 1–2 drift moments per lap, 45–90 second laps.

Planned archetypes:

1. **Oval tutorial** — wide, forgiving, teaches steering and drift
2. **Technical circuit** — tight S-curves, rewards clean lines
3. **Off-road / park** — narrow sections, slowdown surfaces at the edges
4. **Neon / night** — low-contrast art test, same readability bar

A track counts when it is fully drivable start-to-finish with collision boundaries, a timed lap, and its theme applied.

First playable needs only track #1.

## 8. Controls and platform

- **First:** desktop browser, keyboard (arrows + WASD). 60fps target.
- **Later:** gamepad support.
- **Non-goal for MVP:** touch controls, mobile optimization.

Controls must be remappable in the future, hardcoded for the first playable.

## 9. Art direction

Low-poly, flat-shaded, bold colors. Chunky karts, simple environments, strong silhouettes.

Readability rules beat realism: track edges pop, racing line is obvious, karts read at distance.

No photorealism, no heavy post-processing in MVP.

## 10. Audio direction

Placeholder scope: engine hum, drift skid, boost whoosh, countdown beeps, lap jingle.

Music: single loopable energetic track per theme eventually. Not required for first playable. Sound can start as synthesized placeholders.

## 11. Tech direction

- **Site:** Astro as the site shell (landing, track/character showcase later). It hosts the game, it is not the game loop. Output is fully static (`output: 'static'` -> `dist/`), deployable to GitHub Pages via the official `withastro/action`.
- **Game:** isolated TypeScript module under `src/game/` rendered with Three.js (`three` + `@types/three` for full typing and editor support). It is bundled as a client-only island: a `<canvas>` plus a module `<script>` importing the game entry. No SSR for the game, so WebGL never runs at build time.
- **Physics:** custom arcade kart physics written for this game. No external physics engine in MVP.
- **Structure:** single Astro project with logical separation — `src/pages/` for the shell, `src/game/` for the engine, `src/components/GameCanvas.astro` as the only bridge. No second deploy, no second build.
- **Hosting:** one `npm run build`, one `dist/`, one static host. Pages project-site config uses `site` + `base: '/RaceSlop/'`.
- **Performance:** low draw calls, shared geometries/materials where possible, no per-frame allocations in the hot loop.

No engine switch (Unity / Godot / PlayCanvas) unless the Three.js prototype proves unviable.

## 12. Non-goals for MVP

- No bots or multiplayer
- No items or pickups
- No kart stats balancing or customization
- No mobile support
- No editor, modding, or user-generated tracks

## 13. Milestones

- **M0 — Vision:** this document. Done when the fantasy, pillars, MVP mode, 4+4 milestone, and non-goals are agreed.
- **M1 — First playable:** 1 kart, 1 track, drive + drift + boost, lap timer, 60fps on desktop.
- **M2 — Roster:** 4 character reskins + 4 tracks, select screens, best-lap persistence locally.
- **M3 — Race vs bots:** grid start, simple bot AI, positions, podium timing.

## 14. What good looks like

The vision works if a new player can answer after one session:

- Why does this game exist? (pure kart flow in the browser)
- What do I do? (drift fast laps, beat my best)
- What is in and what is out? (time-trial yes, items/multiplayer no)
- What comes first? (one fun kart on one readable track)

## 15. Open questions for spec phase

- Standing vs rolling start, lap count, ghost implementation
- Exact drift input and boost tuning numbers
- Track collision model (walls vs soft boundaries)
- Best-lap storage format and select-screen flow
- Performance budget numbers (draw calls, poly counts)
