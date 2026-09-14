# RaceSlop

A singleplayer 3D kart racer for the web. Mario Kart-inspired, time-trial first.

Drive low-poly karts on fast, readable tracks. Nail the drift, chase your best lap.

## Vision (TL;DR)

- **Fantasy:** 30 seconds of pure kart flow — accelerate, drift through a corner, catch a boost, beat your ghost.
- **MVP mode:** solo time-trial. No bots, no items. Just driving, drifting, and lap times.
- **Milestone:** 4 characters + 4 tracks.
- **First playable:** 1 kart + 1 track at 60fps on desktop.

Full vision: `docs/VISION.md`.

## Tech

- Site shell: Astro
- Game: TypeScript + Three.js (`three` + `@types/three`)
- Physics: custom arcade physics in MVP, no external physics engine
- Targets: desktop browsers first, keyboard input first

## Repo layout

- `docs/` — vision and future design docs
- `src/pages/` — Astro static shell (`/` landing, `/play` game page)
- `src/components/GameCanvas.astro` — client-only bridge (canvas + module script, no SSR)
- `src/game/` — isolated Three.js game module (`main.ts` entry)
- `.github/workflows/deploy.yml` — static deploy to GitHub Pages

## Roadmap

- M0 — Vision (this doc)
- M1 — First playable: 1 kart, 1 track, drift + boost, best-lap timer
- M2 — Roster: 4 characters (reskins), 4 tracks
- M3 — Race vs bots (post-MVP)

## Status

Early. Vision draft, no playable build yet.
