# M2 Plan 00 — Data-Driven Track System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded oval with a data-driven track system (`TrackDef` → `buildTrack`) supporting boundary policies and themes, with the oval as the first def.

**Architecture:** Track layouts become `Segment[]` data (straights + signed arcs). `samplePath` integrates segments exactly into a closed center-line; `buildTrack` derives samples, start, and auto-checkpoints from a `TrackDef`. `resolveBoundary` gains a `soft` policy (grass shoulder + outer wall) alongside the M1 `wall` policy. `buildTrackMesh` reads all colors from `def.theme`. `LapTracker`, `nearestOnCenter`, `isOffTrack`, and `stepKart` are untouched.

**Tech Stack:** TypeScript (strict), vitest, Three.js (mesh only).

**Spec:** `docs/SPEC-M2.md` §4 (track system), §5 (oval row).

**Depends on:** nothing (first M2 plan). Plans 01–04 depend on this one.

## Global Constraints

- TypeScript strict mode, no `any` in game code.
- No external physics engine, ever.
- Center-line sampled at ≤ 2 m steps, exact integration (no drift).
- Oval def must keep the M1 test contract: lap length 350–450 m, halfWidth 6, ≥ 4 ordered checkpoints, wrong-way laps never count.
- Wall policy behavior is byte-for-byte the M1 behavior (clamp, `cancelDrift`, ×0.7 speed).
- `npm test` and `npm run build` must stay green.

---

### Task 1: Segment math — `pathLength` + `samplePath`

**Files:**
- Modify: `src/game/track.ts` (prepend; keep everything else)
- Modify: `src/game/track.test.ts` (prepend new describe block)

**Interfaces:**
- Produces (exact names, used by Tasks 2–3 and Plans 03–04):
  - `type Segment = { kind: 'straight'; length: number } | { kind: 'arc'; radius: number; angle: number }`
  - `interface PathSample { x: number; z: number; heading: number; s: number }`
  - `const SAMPLE_STEP = 1.5`
  - `function pathLength(path: Segment[]): number`
  - `function samplePath(path: Segment[], maxStep?: number): PathSample[]`
- Convention: paths start at `(0, 0)` heading `0` (facing `+z`; `f(h) = (sin h, cos h)`). Positive arc angle increases heading; a `+π/2` arc from origin facing `+z` ends at `(r, r)` facing `+x`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { pathLength, samplePath } from './track';

describe('segment math', () => {
  it('computes path length for straights and arcs', () => {
    const p = [
      { kind: 'straight', length: 80 },
      { kind: 'arc', radius: 40, angle: Math.PI },
    ];
    expect(pathLength(p)).toBeCloseTo(80 + 40 * Math.PI, 6);
  });

  it('samples a straight with uniform sub-steps', () => {
    const s = samplePath([{ kind: 'straight', length: 9 }], 1.5);
    expect(s[0]).toEqual({ x: 0, z: 0, heading: 0, s: 0 });
    expect(s[1].x).toBeCloseTo(0, 6);
    expect(s[1].z).toBeCloseTo(1.5, 6);
    expect(s[s.length - 1].z).toBeCloseTo(9, 6);
    expect(s[s.length - 1].heading).toBe(0);
  });

  it('integrates a quarter arc exactly', () => {
    const s = samplePath([{ kind: 'arc', radius: 10, angle: Math.PI / 2 }], 1.5);
    const end = s[s.length - 1];
    expect(end.x).toBeCloseTo(10, 3);
    expect(end.z).toBeCloseTo(10, 3);
    expect(end.heading).toBeCloseTo(Math.PI / 2, 6);
  });

  it('walks a stadium loop back to the start', () => {
    const stadium = [
      { kind: 'straight', length: 80 },
      { kind: 'arc', radius: 40, angle: Math.PI },
      { kind: 'straight', length: 80 },
      { kind: 'arc', radius: 40, angle: Math.PI },
    ];
    const s = samplePath(stadium, 1.5);
    const end = s[s.length - 1];
    expect(Math.hypot(end.x, end.z)).toBeLessThan(0.5);
    expect(end.heading % (2 * Math.PI)).toBeCloseTo(0, 3);
    expect(end.s).toBeCloseTo(pathLength(stadium), 3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/game/track.test.ts`
Expected: FAIL with "pathLength is not a function" (or import error).

- [ ] **Step 3: Write minimal implementation** (prepend to `src/game/track.ts`)

```ts
export type Segment =
  | { kind: 'straight'; length: number }
  | { kind: 'arc'; radius: number; angle: number };

export interface PathSample {
  x: number;
  z: number;
  heading: number;
  s: number;
}

export const SAMPLE_STEP = 1.5;

export function pathLength(path: Segment[]): number {
  let len = 0;
  for (const seg of path) {
    len += seg.kind === 'straight' ? seg.length : seg.radius * Math.abs(seg.angle);
  }
  return len;
}

// Exact integration: each sub-arc of turn dth and length ds advances by
// (ds/dth) * (M(dth) - I) * f(heading), where M(dth) rotates the heading
// vector forward (M(th) * (sin h, cos h) = (sin(h+th), cos(h+th))); each
// straight sub-step advances along f(heading). Composition is exact, so
// closed paths close to float precision.
export function samplePath(path: Segment[], maxStep = SAMPLE_STEP): PathSample[] {
  const out: PathSample[] = [{ x: 0, z: 0, heading: 0, s: 0 }];
  let x = 0;
  let z = 0;
  let h = 0;
  let s = 0;
  for (const seg of path) {
    const segLen = seg.kind === 'straight' ? seg.length : seg.radius * Math.abs(seg.angle);
    const n = Math.max(1, Math.ceil(segLen / maxStep));
    const ds = segLen / n;
    for (let i = 0; i < n; i++) {
      if (seg.kind === 'straight') {
        x += Math.sin(h) * ds;
        z += Math.cos(h) * ds;
      } else {
        const dth = seg.angle / n;
        const k = ds / dth;
        const c = Math.cos(dth);
        const sn = Math.sin(dth);
        const fx = Math.sin(h);
        const fz = Math.cos(h);
        x += k * (fx * sn + fz * (1 - c));
        z += k * (fz * sn - fx * (1 - c));
        h += dth;
      }
      s += ds;
      out.push({ x, z, heading: h, s });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/game/track.test.ts`
Expected: PASS, segment-math tests green (existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/game/track.ts src/game/track.test.ts
git commit -m "feat: add exact segment sampling for track center-lines"
```

### Task 2: `TrackDef` → `buildTrack`, auto checkpoints, oval def

**Files:**
- Create: `src/game/tracks.ts`
- Modify: `src/game/track.ts`
- Modify: `src/game/track.test.ts`
- Modify: `src/game/main.ts` (import swap only)
- Modify: `src/game/trackMesh.ts` (type-name import only)

**Interfaces:**
- Consumes: `Segment`, `samplePath`, `pathLength` from Task 1; `Vec2` from `./types`.
- Produces (exact names, used by Tasks 3–4, Plans 01–04):
  - `interface TrackTheme { sky: number; asphalt: number; edge: number; shoulder: number; ground: number; barrier: number }`
  - `interface TrackDef { id: string; name: string; halfWidth: number; boundary: 'wall' | 'soft'; shoulder: number; theme: TrackTheme; path: Segment[] }`
  - `interface Track { id: string; samples: Vec2[]; halfWidth: number; shoulder: number; boundary: 'wall' | 'soft'; checkpoints: Checkpoint[]; start: { pos: Vec2; heading: number }; theme: TrackTheme }`
  - `const CHECKPOINT_COUNT = 8`
  - `function buildTrack(def: TrackDef): Track`
  - `function minRadius(path: Segment[]): number`
  - In `src/game/tracks.ts`: `const DEFAULT_THEME: TrackTheme` and `const OVAL_DEF: TrackDef`
- Removes: `OvalTrack`, `buildOval` (rename ripple: `trackMesh.ts` signature becomes `buildTrackMesh(track: Track)`; `main.ts` calls `buildTrack(OVAL_DEF)`).

- [ ] **Step 1: Write the failing tests** (replace the `oval` describe in `src/game/track.test.ts`; update the `LapTracker` describe to 8 checkpoints)

```ts
import { describe, expect, it } from 'vitest';
import { buildTrack, CHECKPOINT_COUNT, isOffTrack, minRadius, nearestOnCenter, resolveBoundary } from './track';
import { OVAL_DEF } from './tracks';
import { createKartState } from './types';

describe('buildTrack (oval def)', () => {
  it('keeps the M1 spec range and width', () => {
    const t = buildTrack(OVAL_DEF);
    let len = 0;
    for (let i = 0; i < t.samples.length; i++) {
      const a = t.samples[i];
      const b = t.samples[(i + 1) % t.samples.length];
      len += Math.hypot(b.x - a.x, b.z - a.z);
    }
    expect(len).toBeGreaterThan(350);
    expect(len).toBeLessThan(450);
    expect(t.halfWidth).toBe(6);
    expect(t.checkpoints.length).toBeGreaterThanOrEqual(4);
  });

  it('auto-derives checkpoints with checkpoint 0 at the start', () => {
    const t = buildTrack(OVAL_DEF);
    expect(t.checkpoints.length).toBe(CHECKPOINT_COUNT);
    expect(Math.hypot(t.checkpoints[0].x - t.start.pos.x, t.checkpoints[0].z - t.start.pos.z)).toBeLessThan(2);
  });

  it('closes the loop within a step of the start', () => {
    const t = buildTrack(OVAL_DEF);
    const tail = t.samples[t.samples.length - 1];
    expect(Math.hypot(tail.x, tail.z)).toBeLessThan(4);
  });

  it('detects off-track beyond asphalt plus margin', () => {
    const t = buildTrack(OVAL_DEF);
    expect(isOffTrack(t.start.pos, t)).toBe(false);
    expect(isOffTrack({ x: 30, z: 0 }, t)).toBe(true);
  });

  it('keeps wall behavior identical to M1', () => {
    const t = buildTrack(OVAL_DEF);
    const s = createKartState(30, 0, 0);
    s.speed = 20;
    s.drifting = true;
    expect(resolveBoundary(s, t)).toBe(true);
    expect(s.drifting).toBe(false);
    const near = nearestOnCenter(s.pos, t.samples);
    expect(near.dist).toBeLessThanOrEqual(t.halfWidth + 0.01);
  });

  it('reports the smallest arc radius', () => {
    expect(minRadius(OVAL_DEF.path)).toBe(40);
  });
});
```

In the existing `LapTracker` describe, update the first test for 8 checkpoints (visiting 1..7 then 0):

```ts
  it('counts a lap after all checkpoints in order', () => {
    const t = buildTrack(OVAL_DEF);
    const tracker = new LapTracker(t.checkpoints);
    tracker.reset(0);
    let lap: number | null = null;
    for (let k = 1; k < t.checkpoints.length; k++) {
      const r = tracker.update({ x: t.checkpoints[k].x, z: t.checkpoints[k].z }, k * 5);
      if (r.lap !== null) lap = r.lap;
    }
    const fin = tracker.update({ x: t.checkpoints[0].x, z: t.checkpoints[0].z }, 8 * 5);
    if (fin.lap !== null) lap = fin.lap;
    expect(lap).toBeCloseTo(40, 6);
    expect(tracker.last).toBeCloseTo(40, 6);
    expect(tracker.best).toBeCloseTo(40, 6);
  });
```

(The two other LapTracker tests — "ignores the line when checkpoints are skipped" and "invalidate restarts" — stay as they are, only switching `buildOval()` → `buildTrack(OVAL_DEF)`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/game/track.test.ts`
Expected: FAIL with "Failed to resolve import './tracks'".

- [ ] **Step 3: Implement**

Create `src/game/tracks.ts`:

```ts
import type { TrackDef, TrackTheme } from './track';

export const DEFAULT_THEME: TrackTheme = {
  sky: 0x111118,
  asphalt: 0x3a3a42,
  edge: 0xff5533,
  shoulder: 0x2a4a2e,
  ground: 0x1e3324,
  barrier: 0xcc2233,
};

// M1 oval as-built: 2 straights of 80 m + 2 semicircles of r=40 -> ~411 m.
export const OVAL_DEF: TrackDef = {
  id: 'oval',
  name: 'Oval Tutorial',
  halfWidth: 6,
  boundary: 'wall',
  shoulder: 0,
  theme: DEFAULT_THEME,
  path: [
    { kind: 'straight', length: 80 },
    { kind: 'arc', radius: 40, angle: Math.PI },
    { kind: 'straight', length: 80 },
    { kind: 'arc', radius: 40, angle: Math.PI },
  ],
};
```

In `src/game/track.ts`: replace the `OvalTrack` interface, the `buildOval` function, and `HALF_STRAIGHT`/`RADIUS` constants with:

```ts
export interface TrackTheme {
  sky: number;
  asphalt: number;
  edge: number;
  shoulder: number;
  ground: number;
  barrier: number;
}

export interface TrackDef {
  id: string;
  name: string;
  halfWidth: number;
  boundary: 'wall' | 'soft';
  shoulder: number;
  theme: TrackTheme;
  path: Segment[];
}

export interface Track {
  id: string;
  samples: Vec2[];
  halfWidth: number;
  shoulder: number;
  boundary: 'wall' | 'soft';
  checkpoints: Checkpoint[];
  start: { pos: Vec2; heading: number };
  theme: TrackTheme;
}

export const CHECKPOINT_COUNT = 8;

export function buildTrack(def: TrackDef): Track {
  const walked = samplePath(def.path);
  const samples: Vec2[] = walked.map((p) => ({ x: p.x, z: p.z }));
  // Closed loop: the walker ends on the start; drop the coincident sample.
  const end = walked[walked.length - 1];
  if (samples.length > 1 && Math.hypot(end.x, end.z) < 1) samples.pop();

  const total = pathLength(def.path);
  const checkpoints: Checkpoint[] = [];
  for (let k = 0; k < CHECKPOINT_COUNT; k++) {
    const sk = (k / CHECKPOINT_COUNT) * total;
    let idx = 0;
    let bestErr = Number.POSITIVE_INFINITY;
    for (let i = 0; i < walked.length; i++) {
      const err = Math.abs(walked[i].s - sk);
      if (err < bestErr) {
        bestErr = err;
        idx = i;
      }
    }
    checkpoints.push({ x: walked[idx].x, z: walked[idx].z, radius: def.halfWidth + 6 });
  }

  return {
    id: def.id,
    samples,
    halfWidth: def.halfWidth,
    shoulder: def.shoulder,
    boundary: def.boundary,
    checkpoints,
    start: { pos: { x: walked[0].x, z: walked[0].z }, heading: walked[0].heading },
    theme: def.theme,
  };
}

export function minRadius(path: Segment[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const seg of path) {
    if (seg.kind === 'arc' && seg.radius < min) min = seg.radius;
  }
  return min;
}
```

Update signatures (`resolveBoundary`, `isOffTrack` bodies unchanged — they read `halfWidth`/`samples` which `Track` still has):

```ts
export function isOffTrack(pos: Vec2, track: Track): boolean
export function resolveBoundary(s: KartState, track: Track): boolean
```

In `src/game/trackMesh.ts` change the import and signature to `Track` (colors stay hardcoded until Task 4). In `src/game/main.ts` change:

```ts
import { buildTrack, isOffTrack, LapTracker, resolveBoundary } from './track';
import { OVAL_DEF } from './tracks';
```

and `const track = buildOval();` → `const track = buildTrack(OVAL_DEF);`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all files green.

- [ ] **Step 5: Verify the build, then commit**

Run: `npm run build`
Expected: builds clean.

```bash
git add src/game/track.ts src/game/track.test.ts src/game/tracks.ts src/game/main.ts src/game/trackMesh.ts
git commit -m "refactor: buildTrack from TrackDef with auto checkpoints"
```

### Task 3: Boundary policies (`soft` shoulders)

**Files:**
- Modify: `src/game/track.ts`
- Modify: `src/game/track.test.ts` (append)

**Interfaces:**
- Consumes: `Track` from Task 2 (already carries `boundary`, `shoulder`).
- Produces: `resolveBoundary(s: KartState, track: Track): boolean` now policy-aware — no signature change. `wall`: clamp at `halfWidth`. `soft`: clamp at `halfWidth + shoulder`, free (slowdown-cap only) inside the shoulder.

- [ ] **Step 1: Write the failing tests**

```ts
import { buildTrack } from './track';
import { OVAL_DEF } from './tracks';
import { createKartState } from './types';

const SOFT_DEF = {
  ...OVAL_DEF,
  id: 'soft-test',
  halfWidth: 4.5,
  boundary: 'soft' as const,
  shoulder: 9,
};

describe('soft boundary policy', () => {
  it('does not clamp inside the grass shoulder', () => {
    const t = buildTrack(SOFT_DEF);
    const s = createKartState(8, 0, 0);
    s.speed = 20;
    expect(resolveBoundary(s, t)).toBe(false);
    expect(s.pos.x).toBe(8);
  });

  it('still flags the shoulder as off-track (slowdown surface)', () => {
    const t = buildTrack(SOFT_DEF);
    expect(isOffTrack({ x: 8, z: 0 }, t)).toBe(true);
  });

  it('clamps at the outer wall with drift cancel and bleed', () => {
    const t = buildTrack(SOFT_DEF);
    const s = createKartState(20, 0, 0);
    s.speed = 20;
    s.drifting = true;
    expect(resolveBoundary(s, t)).toBe(true);
    expect(s.drifting).toBe(false);
    const near = nearestOnCenter(s.pos, t.samples);
    expect(near.dist).toBeLessThanOrEqual(t.halfWidth + t.shoulder + 0.01);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/game/track.test.ts`
Expected: FAIL — first test: `resolveBoundary` returns `true` at dist 8 (wall behavior clamps at 4.5).

- [ ] **Step 3: Implement** (replace `resolveBoundary` in `src/game/track.ts`)

```ts
export function resolveBoundary(s: KartState, track: Track): boolean {
  const near = nearestOnCenter(s.pos, track.samples);
  const limit = track.boundary === 'soft' ? track.halfWidth + track.shoulder : track.halfWidth;
  if (near.dist <= limit) return false;
  const over = near.dist - limit;
  const nx = (s.pos.x - near.x) / near.dist;
  const nz = (s.pos.z - near.z) / near.dist;
  s.pos.x -= nx * over;
  s.pos.z -= nz * over;
  cancelDrift(s);
  s.speed *= 0.7;
  return true;
}
```

`isOffTrack` is unchanged (asphalt + 2 m margin = on the slowdown surface). `main.ts` needs no change: its `isOffTrack` cap is the shoulder's slowdown for soft tracks and stays a safety net for wall tracks.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all green.

- [ ] **Step 5: Commit**

```bash
git add src/game/track.ts src/game/track.test.ts
git commit -m "feat: add soft boundary policy for grass shoulders"
```

### Task 4: Theme-aware `buildTrackMesh`

**Files:**
- Modify: `src/game/trackMesh.ts`
- Modify: `src/game/main.ts` (background from theme)

**Interfaces:**
- Consumes: `Track` (with `theme`, `boundary`, `shoulder`) from Task 2.
- Produces: `function buildTrackMesh(track: Track): THREE.Group` — same 5 pieces for wall tracks; soft tracks add a shoulder ribbon and move barriers to `halfWidth + shoulder`. Material count ≤ 6.

- [ ] **Step 1: Implement the theme wiring**

In `src/game/trackMesh.ts`:

1. Replace every hardcoded color with the `track.theme` field (`asphalt`, `edge`, `ground`, `barrier`; the start stripe stays white).
2. Compute the wall offset once: `const wallOffset = track.boundary === 'soft' ? track.shoulder : 0;` and build the barrier ribbons at `left(i, wallOffset)` / `right(i, wallOffset)`.
3. For `soft` tracks, add a shoulder ribbon using the same triangle-strip code as the asphalt, spanning offsets `0..shoulder` on both sides (four offset rows: `±(hw) .. ±(hw + shoulder)`), colored `track.theme.shoulder`, at y `0.01`.
4. For `soft` tracks, draw the edge lines at the asphalt edge (`extra = 0`) so the readable boundary stays the asphalt/grass line.

- [ ] **Step 2: Wire the sky** in `src/game/main.ts`

```ts
scene.background = new THREE.Color(track.theme.sky);
```

(replacing `new THREE.Color(0x111118)`).

- [ ] **Step 3: Verify visually**

Run: `npm run build`, open `/play`.
Expected: identical look to M1 for the oval (hardcoded values moved into `DEFAULT_THEME`); background still `0x111118`. Then temporarily set `OVAL_DEF.boundary = 'soft'` and `shoulder = 9` locally (do not commit): grass ring around the asphalt, barriers pushed out, kart drivable onto grass with the slowdown cap. Revert after checking.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all green, build clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/trackMesh.ts src/game/main.ts
git commit -m "refactor: theme-aware track mesh"
```
