# RaceSlop — Spec M2: Roster

Status: draft
Date: 2026-09-15
Vision: `docs/VISION.md`
Builds on: `docs/SPEC-M1.md` (shipped, PR #1)

## 1. Goal

Four characters and four tracks, selectable in-game, with best-lap persistence
per track. M2 is content breadth over the proven M1 core: the driving model,
physics parameters, and lap rules do not change.

## 2. Scope

In:

- Data-driven track system (layouts defined as segment lists, not code)
- 3 new tracks (technical circuit, off-road park, neon night) + oval retained
- 4 character reskins (distinct look, identical handling)
- Character select → track select → race flow as a DOM overlay in `/play`
- Best-lap persistence per track in `localStorage`

Out (M3+ or never):

- Bots, items, multiplayer, ghosts, audio, gamepad, touch
- Per-character stats, kart customization
- Track editor, remapping UI, design-system polish

## 3. Locked decisions (from VISION §15 open questions)

| Question | Decision |
|---|---|
| Select-screen flow | DOM overlay inside `/play` (same page, keyboard-driven). No new Astro routes; `GameCanvas.astro` stays the only bridge. |
| Best-lap storage | `localStorage`, key `raceslop.records.v1`, value `{"version":1,"best":{"<trackId>":<seconds>}}`. Fail-soft: memory fallback when storage is unavailable. |
| Character identity | Placeholder names/palettes below; renamable without code changes beyond the data table. |
| Lap counting | Unchanged from M1: ordered checkpoints, wrong-way laps never count. |

## 4. Track system

A track is data (`TrackDef`), not code:

```ts
type Segment =
  | { kind: 'straight'; length: number }
  | { kind: 'arc'; radius: number; angle: number }; // angle signed, radians; |angle| <= PI

interface TrackDef {
  id: string;            // stable persistence key
  name: string;
  halfWidth: number;     // asphalt half-width, meters
  boundary: 'wall' | 'soft';
  shoulder: number;      // soft only: slowdown surface width before the outer wall
  theme: TrackTheme;     // sky, asphalt, edge, shoulder, ground, barrier colors
  path: Segment[];       // closed loop, starts at the start/finish line
}
```

Rules:

- **Sampling:** the center-line is sampled at ≤ 2 m steps by exact
  straight/arc integration (no spline, no approximation drift).
- **Closure:** a def is valid only if the path returns to its start point
  (< 2 m gap, enforced by tests). All four defs use point symmetry
  (identical half-lists, net heading π each) so closure is guaranteed.
- **Checkpoints:** auto-derived, 8 per track, evenly spaced by arc length,
  radius `halfWidth + 6`. Checkpoint 0 sits at the start/finish line.
- **Boundary policy:**
  - `wall` (M1 behavior): invisible wall at the asphalt edge — clamp
    position, cancel drift charge, ×0.7 speed bleed.
  - `soft`: no clamp on a `shoulder`-wide slowdown surface (grass) beyond the
    asphalt; the speed cap (`offTrackCap`) applies there; an outer wall at
    `halfWidth + shoulder` clamps escapes with wall behavior.
- **Theme:** the mesh builder and scene background read all colors from
  `theme`. Readability bar for every theme: track edges pop against asphalt
  and ground at race speed.

## 5. The four tracks

Lap-pace math: realistic race pace is 18–22 m/s average (top speed 28, drift
bleed, corners). Vision's 45–90 s band assumes the slow end; T4 lands inside
it, T2/T3 land shorter. Final numbers are tuning, not redesign.

| # | id | Name | halfWidth | Boundary | Min radius | Lap length | Character |
|---|---|---|---|---|---|---|---|
| 1 | `oval` | Oval Tutorial | 6 m | wall | 40 m | ~411 m (~20 s) | M1 as-built, unchanged |
| 2 | `circuit` | Technical Circuit | 6 m | wall | 20 m | 650–750 m (~35–40 s) | S-curve chicanes, tight entries reward clean lines |
| 3 | `park` | Off-road Park | 4.5 m | soft (shoulder 9 m) | 18 m | 600–900 m (~35–45 s) | Narrow asphalt, grass shoulders punish wide lines |
| 4 | `neon` | Neon Night | 7 m | wall | 40 m | 1000–1250 m (~50–65 s) | Wide flowing sweepers, dark theme readability test |

Design constraints for all new tracks: min corner radius ≥ 18 m (readable at
speed, cornerable without drift at ~20 m/s), 1–2 drift moments per lap,
start/finish on a straight, no self-intersecting layouts.

## 6. Characters (roster of 4)

Reskins on one shared kart: identical handling — a single `DEFAULT_PARAMS`
for everyone. No per-character stats in M2.

| id | Name (placeholder) | Role | Body | Accent | Silhouette (w×h×l) |
|---|---|---|---|---|---|
| `rex` | Rex | Balanced rookie | `0xff3355` | `0xffcc33` | 1.0 × 1.0 × 1.0 |
| `bruno` | Bruno | Heavy bruiser | `0x557744` | `0xdddd33` | 1.15 × 1.1 × 1.1 |
| `mika` | Mika | Light nimble | `0x33ccee` | `0xffffff` | 0.9 × 0.95 × 0.9 |
| `nyx` | Nyx | Wildcard | `0xaa33ee` | `0x22ffaa` | 1.0 × 1.25 × 0.95 |

A character counts when the palette + silhouette read in-game and on the
select screen. Names/palettes are data; rename freely.

## 7. Select flow

States: `character → track → race`.

- **Character select:** ←/→ moves the cursor (wraps), Enter confirms.
- **Track select:** ←/→ moves (wraps), Enter starts the race, Esc goes back
  to character select. Each track card shows its all-time best from records.
- **Race:** M1 rules unchanged (Enter restarts timer, R resets to track).
  Esc exits to track select.
- Cursor resets to the first item on each screen entry. Last selection is
  not persisted across sessions (records store bests only).
- Menus render as a DOM overlay over the canvas; the race loop is paused
  while a menu is up. No mouse support in M2.

## 8. Records

- Written on every valid lap: better-than-stored persists, worse does not.
- Precision: centiseconds (round on write, `Math.round(sec * 100) / 100`).
- HUD "best" shows the all-time best for the current track (seeded from
  storage at race start, updated live when beaten — M1 semantics).
- Corruption policy: unparsable or wrong-version payload is discarded and
  treated as empty. Storage unavailable (private mode) → in-memory fallback,
  game never errors.

## 9. Input (M2 additions)

| Action | Keys | Where |
|---|---|---|
| Confirm / restart timer | Enter | menus + race |
| Back | Esc | track select, race |
| Cursor | ←/→ (+A/D) | menus |

`restart` in `RawInput` is renamed `confirm` (same key, race keeps its M1
behavior). Escape joins the prevent-default set.

## 10. Module structure

New files (existing M1 modules keep their roles):

- `src/game/tracks.ts` — the four `TrackDef` data entries
- `src/game/characters.ts` — `CharacterDef[]` + `buildKartMesh(def)`
- `src/game/records.ts` — pure record store + browser adapter
- `src/game/flow.ts` — select-flow state machine + overlay rendering

Modified: `track.ts` (generic `buildTrack`, boundary policies),
`trackMesh.ts` (theme-aware), `input.ts` (Escape, confirm rename),
`main.ts` (flow wiring, per-race scene assembly), `GameCanvas.astro`
(overlay element). `initGame(canvas, hud, overlay)` remains the only entry.

## 11. Acceptance (M2 done)

- [ ] `/play` boots into character select; 4 characters visually distinct
- [ ] Track select shows 4 tracks, each with its stored best or `--:--.--`
- [ ] All 4 tracks drivable start-to-finish with correct lap counting
- [ ] Park slows on grass shoulders; walls behave per policy on all tracks
- [ ] Best lap per track survives reload; HUD best = all-time best
- [ ] Handling identical across all 4 characters
- [ ] Esc flow works both directions; race rules unchanged from M1
- [ ] `npm run build` green; no console errors in a 10-minute session; no
      visible stutter on any track

## 12. Open tuning (not decisions)

Exact segment lengths/radii within §5 ranges, drift-corner pacing, palette
values, and overlay copy are tuned by playing, not by further spec. If a
range blocks playability, adjust within §5 constraints and note the final
value in the M2 close-out.
