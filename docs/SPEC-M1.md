# RaceSlop — Spec M1: First Playable

Status: draft
Date: 2026-09-14
Vision: `docs/VISION.md`

## 1. Goal

One drivable kart on one readable oval. Prove the driving core: accelerate,
steer, drift, boost, and chase lap times. Placeholder art is acceptable —
gameplay is what M1 proves.

## 2. Scope

In:

- 1 kart (placeholder model), 1 flat oval track
- Arcade driving: accelerate, brake/reverse, steer, drift, drift-boost
- Free lapping with lap timer: current lap, last lap, best lap
- Instant restart (timer) and reset-to-track
- Fixed chase camera, keyboard input, desktop browsers

Out (deferred to M2/M3):

- Bots, items, multiplayer
- Kart stats, character select, track select
- Gamepad, touch, audio, ghosts, persistence
- Final art models, lighting polish, menus

## 3. Physics (arcade, custom)

Units: meters, seconds. Defaults are starting points with tuning ranges —
tune within the range, do not redesign the model in M1.

| Parameter | Default | Tuning range | Notes |
|---|---|---|---|
| Top speed | 28 m/s | 24–32 | Flat, no draft/slipstream |
| 0 → top speed | ~3.0 s | 2.5–4.0 | Single exponential approach, no gears |
| Brake decel | 30 m/s² | 25–40 | Strong, arcade |
| Reverse max | 8 m/s | 6–10 | — |
| Steering (full lock, at speed) | yaw ~2.2 rad/s | 1.8–2.6 | Reduce at very low speed to avoid spinning in place |
| Grip (lateral slide, normal cornering) | high | — | Kart follows heading; no sustained slide outside drift |
| Off-track slowdown | cap 12 m/s | 10–14 | Grass/sand outside asphalt |
| Collision | stop + slide along wall | — | No bounce, no damage, minimal speed loss along wall |

The oval must be cornerable without drifting (slower) and faster with drifting.

## 4. Drift + boost

- **Initiate:** hold drift key (Space or Shift) while steering above ~40% of top speed. Small lateral kick toward the outside, heading preserved.
- **Hold:** steering controls drift angle (up to ~30°); throttle stays pinned; slight speed bleed (~5–10% below top speed while drifting).
- **Release:** on drift-key release, grant a boost proportional to continuous drift time:
  - < 0.5 s: no boost (tap forgiveness)
  - 0.5–1.5 s: small boost (~+15% speed, ~0.6 s)
  - > 1.5 s: full boost (~+25% speed, ~1.0 s), capped — longer holds do not stack further
- **Interrupt:** hitting a wall or dropping below 40% top speed cancels the charge with no boost.
- **Feedback (placeholder):** FOV kick or speed lines optional; at minimum a visible kart yaw + a short exhaust flash or HUD text. Exact effect TBD at implementation, keep it cheap.

## 5. Track 1: oval tutorial

- **Layout:** flat closed loop, two straights + two sweepers. Center-line length ~350–450 m, laps of roughly 15–25 s at top speed.
- **Width:** ~12 m asphalt everywhere, generous and forgiving.
- **Surface:** asphalt (full speed) + surrounding slowdown surface (cap per §3).
- **Boundaries:** invisible collision walls at the asphalt edge + a low visual barrier (contrasting color) so the edge reads at speed.
- **Start/finish:** visible line across the track; cross detection by center-line progress + plane crossing. Direction enforced (wrong-way laps do not count).
- **Lap logic:** free lapping until reset. No lap limit, no race end in M1. Cutting detection: require passing ordered checkpoints (min. 4: one per corner/straight) before a crossing counts.

## 6. Timer

- HUD always shows: current lap time, last lap time, best lap time.
- Best lap updates live when beaten.
- Invalid laps (reset-to-track pressed mid-lap, wrong way) are discarded, timer restarts.
- Precision: centiseconds (0.00 s).

## 7. Input (M1, hardcoded)

| Action | Keys |
|---|---|
| Throttle | Up / W |
| Brake / reverse | Down / S |
| Steer | Left / Right, A / D |
| Drift (hold) | Space or Shift |
| Reset to track | R (kart back on center-line, lap invalidated) |
| Restart timer | Enter (best lap kept) |

No remapping UI in M1. Prevent default scrolling for game keys while the canvas is active.

## 8. Camera

Fixed chase cam: ~3 m above, ~6 m behind kart, look-ahead at kart + velocity blend. No player camera control in M1. Keep the kart framed and the next corner visible on the oval.

## 9. Placeholder visuals (acceptable for M1)

- Kart: box body in driver color + 4 cylinder wheels. Must read heading clearly.
- Track: flat asphalt ribbon with high-contrast edges, start/finish stripe, low barrier walls, big ground plane.
- Lighting: one directional + ambient. No shadows required in M1 (nice-to-have if free).
- HUD: minimal DOM overlay (times + drift/boost state). No design system yet.

## 10. Module structure

Keep the game isolated behind `src/game/main.ts` (`initGame(canvas)` stays the entry).
Suggested split as it grows (do not over-engineer on day one):

- `src/game/main.ts` — boot, loop, wiring
- `src/game/kart.ts` — kart state + arcade physics step
- `src/game/track.ts` — oval geometry, checkpoints, lap logic
- `src/game/input.ts` — keyboard state
- `src/game/camera.ts` — chase cam
- `src/game/hud.ts` — DOM timer overlay

`GameCanvas.astro` remains the only Astro ↔ game bridge.

## 11. Acceptance (M1 done)

- [ ] Loads at `/play` from the static build with no errors
- [ ] Completes timed laps in both directions of input (left/right corners)
- [ ] Drift initiates, holds angle, and releases into a noticeable boost
- [ ] Timer shows current/last/best; best updates; invalid laps discarded
- [ ] R resets to track, Enter restarts timer — both instant
- [ ] Smooth on a typical desktop (no hard fps gate in M1, but no visible stutter on the oval)
- [ ] No console errors during a 5-minute session

## 12. Open tuning (not decisions)

Exact feel numbers (steering curve vs speed, drift bleed, boost strength) are
tuned by driving the oval, not by further spec. If a default in §3 blocks
playability, adjust within range and note the final value in the M1 close-out.
