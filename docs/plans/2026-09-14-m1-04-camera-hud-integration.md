# M1 Plan 04 — Camera, HUD, Integration + M1 Acceptance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chase camera, timer HUD, and the full game loop wired in `main.ts`, closing every M1 acceptance item.

**Architecture:** `computeChasePose` is pure and tested; `applyChaseCamera` is a thin Three.js wrapper. `formatTime` is pure and tested; `updateHud` writes to `[data-*]` spans. `main.ts` owns the renderer, fixed-step accumulator (dt clamped to 0.05), and per-frame order: input → physics → boundaries/off-track → laps → camera → HUD.

**Tech Stack:** TypeScript (strict), vitest, Three.js.

**Spec:** `docs/SPEC-M1.md` §6 (timer), §8 (camera), §9 (placeholder visuals), §11 (acceptance).

## Global Constraints

- TypeScript strict mode, no `any` in game code.
- No external physics engine, ever.
- Camera fixed: ~3 m above, ~6 m behind, look-ahead toward velocity. No player camera control in M1.
- HUD shows current / last / best with centisecond precision, always visible.
- R resets to track (lap invalidated), Enter restarts timer (best kept) — both instant.
- `npm run build` must stay green; `/play` must run from the static build with zero console errors.

---

### Task 1: Chase camera pose

**Files:**
- Create: `src/game/camera.ts`
- Create: `src/game/camera.test.ts`

**Interfaces:**
- Consumes: `Vec2` from `./types`.
- Produces (exact names):
  - `interface ChasePose { camX: number; camY: number; camZ: number; lookX: number; lookY: number; lookZ: number }`
  - `function computeChasePose(pos: Vec2, heading: number): ChasePose`
  - `function applyChaseCamera(camera: THREE.PerspectiveCamera, pose: ChasePose): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { computeChasePose } from './camera';

describe('computeChasePose', () => {
  it('sits behind and above, looking ahead', () => {
    const pose = computeChasePose({ x: 10, z: 20 }, 0);
    expect(pose.camX).toBeCloseTo(10, 6);
    expect(pose.camY).toBeCloseTo(3, 6);
    expect(pose.camZ).toBeCloseTo(14, 6);
    expect(pose.lookX).toBeCloseTo(10, 6);
    expect(pose.lookZ).toBeCloseTo(24, 6);
  });
});
```

(Heading 0 faces +z, so the camera sits at z − 6 and looks to z + 4.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/camera.test.ts`
Expected: FAIL with "Failed to resolve import './camera'".

- [ ] **Step 3: Write minimal implementation**

```ts
import * as THREE from 'three';
import type { Vec2 } from './types';

export interface ChasePose {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

const CAM_BACK = 6;
const CAM_UP = 3;
const LOOK_AHEAD = 4;

export function computeChasePose(pos: Vec2, heading: number): ChasePose {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return {
    camX: pos.x - fx * CAM_BACK,
    camY: CAM_UP,
    camZ: pos.z - fz * CAM_BACK,
    lookX: pos.x + fx * LOOK_AHEAD,
    lookY: 1,
    lookZ: pos.z + fz * LOOK_AHEAD,
  };
}

export function applyChaseCamera(camera: THREE.PerspectiveCamera, pose: ChasePose): void {
  camera.position.set(pose.camX, pose.camY, pose.camZ);
  camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/game/camera.test.ts`
Expected: PASS.

### Task 2: Timer HUD

**Files:**
- Create: `src/game/hud.ts`
- Create: `src/game/hud.test.ts`

**Interfaces:**
- Produces (exact names):
  - `function formatTime(sec: number): string` (`m:ss.cc`)
  - `interface HudData { current: number; last: number | null; best: number | null; drifting: boolean; boost: boolean }`
  - `function updateHud(root: HTMLElement, d: HudData): void` (writes `[data-hud="current|last|best|state"]` spans; creates them if missing)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { formatTime } from './hud';

describe('formatTime', () => {
  it('formats centiseconds with minutes', () => {
    expect(formatTime(65.2)).toBe('1:05.20');
    expect(formatTime(9.876)).toBe('0:09.88');
    expect(formatTime(0)).toBe('0:00.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/hud.test.ts`
Expected: FAIL with "Failed to resolve import './hud'".

- [ ] **Step 3: Write minimal implementation**

```ts
export function formatTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const m = Math.floor(clamped / 60);
  const s = clamped - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export interface HudData {
  current: number;
  last: number | null;
  best: number | null;
  drifting: boolean;
  boost: boolean;
}

function cell(root: HTMLElement, name: string, label: string): HTMLElement {
  const existing = root.querySelector<HTMLElement>(`[data-hud="${name}"]`);
  if (existing) return existing;
  const wrap = document.createElement('div');
  const lab = document.createElement('span');
  lab.textContent = `${label} `;
  const val = document.createElement('span');
  val.setAttribute('data-hud', name);
  wrap.append(lab, val);
  root.appendChild(wrap);
  return val;
}

const DASH = '--:--.--';

export function updateHud(root: HTMLElement, d: HudData): void {
  cell(root, 'current', 'TIME').textContent = formatTime(d.current);
  cell(root, 'last', 'LAST').textContent = d.last === null ? DASH : formatTime(d.last);
  cell(root, 'best', 'BEST').textContent = d.best === null ? DASH : formatTime(d.best);
  const state = d.boost ? 'BOOST' : d.drifting ? 'DRIFT' : '';
  cell(root, 'state', '').textContent = state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/game/hud.test.ts`
Expected: PASS.

### Task 3: Full loop in main.ts

**Files:**
- Modify: `src/game/main.ts`
- Modify: `src/components/GameCanvas.astro` (add HUD container div)

**Interfaces:**
- Consumes: everything from Plans 00–03 plus `computeChasePose`/`applyChaseCamera`, `formatTime`-backed `updateHud`.

- [ ] **Step 1: Rewrite the loop**

Replace the placeholder scene in `src/game/main.ts` with this exact per-frame order:

1. `dt = min(clock.getDelta(), 0.05)`; accumulate `now += dt` (own clock in seconds for lap timing).
2. `raw` from the attached keyboard state; `drive = toDriveInput(raw)`; `actions = consumeActions(raw)`.
3. If `actions.restart`: `tracker.reset(now)`. If `actions.reset`: respawn kart at nearest center sample heading along track tangent, `speed = 0`, `tracker.invalidate(now)`.
4. `stepKart(kart, drive, DEFAULT_PARAMS, dt)`.
5. If `resolveBoundary(kart, track)`: nothing extra (it already cancels drift and bleeds speed).
6. If `isOffTrack(kart.pos, track)` and `kart.speed > DEFAULT_PARAMS.offTrackCap`: clamp to cap.
7. `tracker.update(kart.pos, now)`; sync the placeholder kart mesh position/rotation (`mesh.position.set(x, 0.5, z)`, `mesh.rotation.y = heading + driftAngle`). The kart mesh itself is created once at boot: box body in driver red + 4 cylinder wheels, heading readable from behind (SPEC-M1 §9).
8. `applyChaseCamera(camera, computeChasePose(kart.pos, kart.heading))`.
9. `updateHud(hudEl, { current: tracker.current, last: tracker.last, best: tracker.best, drifting: kart.drifting, boost: kart.boostTime > 0 })`.

Respawn tangent: compute from nearest-sample neighbors (sample[i+1] − sample[i−1] normalized → `heading = atan2(dx, dz)`). Clamp `dt`, never pass raw `getDelta()` spikes to physics.

Add `<div id="raceslop-hud">` overlay in `GameCanvas.astro` and pass it to `initGame(canvas, hud)` — update the signature to `initGame(canvas: HTMLCanvasElement, hud: HTMLElement): void`.

- [ ] **Step 2: Run unit tests + static build**

Run: `npm test`
Expected: PASS, all suites green.

Run: `npm run build`
Expected: succeeds, `output: "static"`, `/play` generated.

- [ ] **Step 3: Drive the M1 acceptance session**

Serve `dist/` (or `npm run preview`), open `/play`, and check every SPEC-M1 §11 box by hand: complete timed laps both directions, drift → visible boost, best-lap updates, invalid laps discarded, R/Enter instant, 5 minutes with zero console errors.
Expected: all boxes checked; any tuning stays inside SPEC-M1 §3 ranges.

- [ ] **Step 4: Commit**

```bash
git add src/game/camera.ts src/game/camera.test.ts src/game/hud.ts src/game/hud.test.ts src/game/main.ts src/components/GameCanvas.astro
git commit -m "feat: wire M1 loop with chase cam, HUD, and lap timing"
```
