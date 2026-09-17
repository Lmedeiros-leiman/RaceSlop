# M2 Plan 00 — Data-Driven Track System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded oval with a data-driven track system (`TrackDef` → `sampleTrack` → `buildTrack` + `validateTrackDef`) supporting boundary policies and themes, with the oval as the first def in M1 parity.

**Architecture:** Track layouts become `Segment[]` data (straights + signed arcs). `samplePath` integrates segments exactly into a closed center-line; the shared `sampleTrack(def)` helper returns samples + length and feeds `buildTrack`, checkpoint derivation, and `validateTrackDef` (closure, radius, self-intersection, checkpoint spacing). `resolveBoundary` gains a `soft` policy (grass shoulder + outer wall) alongside the M1 `wall` policy; `isOffTrack` drops the M1 `+2` tolerance. `buildTrackMesh` reads all colors from `def.theme` and orients the start stripe to the start tangent. `LapTracker`, `nearestOnCenter`, and `stepKart` are untouched.

**Tech Stack:** TypeScript (strict), vitest, Three.js (mesh only).

**Spec:** `docs/SPEC-M2.md` §4 (track system + validation), §5 (oval parity).

**Depends on:** nothing (first M2 plan). Plans 01–04 depend on this one.

## Global Constraints

- TypeScript strict mode, no `any` in game code.
- No external physics engine, ever.
- Center-line sampled at ≤ 2 m steps (`SAMPLE_STEP = 1.5`), exact integration (no drift).
- Oval parity (SPEC-M2 §4/§5): `buildTrack(OVAL_DEF)` keeps lap length 350–450 m, halfWidth 6, and the M1 as-built 4 checkpoints with radii 10/12 — expressed in the new stadium frame. Wrong-way laps never count (ordered checkpoints).
- `isOffTrack` uses the exact `halfWidth` band (no `+2` tolerance).
- Wall policy behavior is byte-for-byte the M1 behavior (clamp, `cancelDrift`, ×0.7 speed).
- `npm test` and `npm run build` must stay green.

---

### Task 1: Segment math — `pathLength`, `samplePath`, `sampleTrack`

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
  - `interface TrackWalk { samples: PathSample[]; length: number }` — produced by the shared helper below; checkpoint spacing and lap-length checks measure from `length`
  - `function sampleTrack(def: TrackDef): TrackWalk` (defined in Task 2 once `TrackDef` exists; declared here for context)
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

  it('walks a stadium loop back to the start, heading included', () => {
    const stadium = [
      { kind: 'straight', length: 80 },
      { kind: 'arc', radius: 40, angle: Math.PI },
      { kind: 'straight', length: 80 },
      { kind: 'arc', radius: 40, angle: Math.PI },
    ];
    const s = samplePath(stadium, 1.5);
    const end = s[s.length - 1];
    expect(Math.hypot(end.x, end.z)).toBeLessThan(0.5);
    const TAU = Math.PI * 2;
    const wrapped = ((end.heading % TAU) + TAU) % TAU;
    expect(Math.min(wrapped, TAU - wrapped)).toBeLessThan(0.01);
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

### Task 2: `TrackDef` → `buildTrack`, checkpoint override, oval parity, exact `isOffTrack`

**Files:**
- Create: `src/game/tracks.ts`
- Modify: `src/game/track.ts`
- Modify: `src/game/track.test.ts` (replace the `oval` describe; restore the M1-shaped `LapTracker` test)
- Modify: `src/game/main.ts` (import swap only)
- Modify: `src/game/trackMesh.ts` (type-name import only)

**Interfaces:**
- Consumes: `Segment`, `samplePath`, `pathLength` from Task 1; `Vec2` from `./types`.
- Produces (exact names, used by Tasks 3–5, Plans 01–04):
  - `interface TrackTheme { sky: number; asphalt: number; edge: number; shoulder: number; ground: number; barrier: number }`
  - `interface TrackDef { id: string; name: string; halfWidth: number; boundary: 'wall' | 'soft'; shoulder: number; theme: TrackTheme; path: Segment[]; checkpoints?: Checkpoint[] }` — `checkpoints` overrides auto-derivation (oval M1 parity); absent → 8 auto checkpoints
  - `function sampleTrack(def: TrackDef): TrackWalk` (with `interface TrackWalk { samples: PathSample[]; length: number }`)
  - `function deriveCheckpoints(def: TrackDef, walked: PathSample[], length: number): Checkpoint[]` — 8 entries, evenly spaced by arc length, radius `halfWidth + 6`, checkpoint 0 at the start/finish line
  - `interface Track { id: string; samples: Vec2[]; halfWidth: number; shoulder: number; boundary: 'wall' | 'soft'; checkpoints: Checkpoint[]; start: { pos: Vec2; heading: number }; theme: TrackTheme }`
  - `const CHECKPOINT_COUNT = 8`
  - `function buildTrack(def: TrackDef): Track`
  - `function minRadius(path: Segment[]): number`
  - In `src/game/tracks.ts`: `const DEFAULT_THEME: TrackTheme` and `const OVAL_DEF: TrackDef` (with the M1 checkpoints override)
- Removes: `OvalTrack`, `buildOval` (rename ripple: `trackMesh.ts` signature becomes `buildTrackMesh(track: Track)`; `main.ts` calls `buildTrack(OVAL_DEF)`).
- `isOffTrack` becomes the exact band: `dist > track.halfWidth` (the M1 `+2` margin is removed).

- [ ] **Step 1: Write the failing tests** (replace the `oval` describe in `src/game/track.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { buildTrack, isOffTrack, minRadius, nearestOnCenter, resolveBoundary } from './track';
import { OVAL_DEF } from './tracks';
import { createKartState } from './types';

describe('buildTrack (oval def, M1 parity)', () => {
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
  });

  it('keeps the M1 as-built checkpoints with radii 10/12', () => {
    const t = buildTrack(OVAL_DEF);
    expect(t.checkpoints).toHaveLength(4);
    expect(t.checkpoints.map((c) => c.radius)).toEqual([10, 12, 10, 12]);
    const [c0, c1, , c3] = t.checkpoints;
    expect(c0.x).toBeCloseTo(0, 3);
    expect(c0.z).toBeCloseTo(0, 3);
    expect(c1.x).toBeCloseTo(40, 3);
    expect(c1.z).toBeCloseTo(120, 3);
    expect(c3.x).toBeCloseTo(40, 3);
    expect(c3.z).toBeCloseTo(-40, 3);
  });

  it('auto-derives 8 checkpoints when no override is given', () => {
    const def = { ...OVAL_DEF, checkpoints: undefined };
    const t = buildTrack(def);
    expect(t.checkpoints).toHaveLength(8);
    expect(t.checkpoints.every((c) => c.radius === 12)).toBe(true);
    expect(Math.hypot(t.checkpoints[0].x - t.start.pos.x, t.checkpoints[0].z - t.start.pos.z)).toBeLessThan(2);
  });

  it('detects off-track at the exact asphalt band (no +2 tolerance)', () => {
    const t = buildTrack(OVAL_DEF);
    expect(isOffTrack(t.start.pos, t)).toBe(false);
    expect(isOffTrack({ x: 6.5, z: 3 }, t)).toBe(true);
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

Restore the M1-shaped `LapTracker` test (4 checkpoints make the M1 sequence valid again) and keep the other two LapTracker tests with `buildOval()` → `buildTrack(OVAL_DEF)`:

```ts
  it('counts a lap after all checkpoints in order', () => {
    const t = buildTrack(OVAL_DEF);
    const tracker = new LapTracker(t.checkpoints);
    tracker.reset(0);
    const seq = [t.checkpoints[1], t.checkpoints[2], t.checkpoints[3], t.checkpoints[0]];
    let lap: number | null = null;
    seq.forEach((cp, i) => {
      const r = tracker.update({ x: cp.x, z: cp.z }, (i + 1) * 5);
      if (r.lap !== null) lap = r.lap;
    });
    expect(lap).toBeCloseTo(20, 6);
    expect(tracker.last).toBeCloseTo(20, 6);
    expect(tracker.best).toBeCloseTo(20, 6);
  });
```

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

// M1 oval as-built (SPEC-M2 §4/§5 parity): 2 straights of 80 m + 2
// semicircles of r=40 -> ~411 m, and the M1 checkpoints (mid-straights r10,
// corner apexes r12) expressed in the new stadium frame: start (0, 0)
// facing +z, first corner apex at (40, 120), etc.
export const OVAL_DEF: TrackDef = {
  id: 'oval',
  name: 'Oval Tutorial',
  halfWidth: 6,
  boundary: 'wall',
  shoulder: 0,
  theme: DEFAULT_THEME,
  checkpoints: [
    { x: 0, z: 0, radius: 10 },
    { x: 40, z: 120, radius: 12 },
    { x: 80, z: 40, radius: 10 },
    { x: 40, z: -40, radius: 12 },
  ],
  path: [
    { kind: 'straight', length: 80 },
    { kind: 'arc', radius: 40, angle: Math.PI },
    { kind: 'straight', length: 80 },
    { kind: 'arc', radius: 40, angle: Math.PI },
  ],
};
```

In `src/game/track.ts`: replace the `OvalTrack` interface, `buildOval`, and the `HALF_STRAIGHT`/`RADIUS` constants with:

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
  checkpoints?: Checkpoint[];
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

export interface TrackWalk {
  samples: PathSample[];
  length: number;
}

export const CHECKPOINT_COUNT = 8;

export function sampleTrack(def: TrackDef): TrackWalk {
  return { samples: samplePath(def.path), length: pathLength(def.path) };
}

export function deriveCheckpoints(def: TrackDef, walked: PathSample[], length: number): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  for (let k = 0; k < CHECKPOINT_COUNT; k++) {
    const sk = (k / CHECKPOINT_COUNT) * length;
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
  return checkpoints;
}

export function buildTrack(def: TrackDef): Track {
  const { samples: walked, length } = sampleTrack(def);
  const samples: Vec2[] = walked.map((p) => ({ x: p.x, z: p.z }));
  // Closed loop: the walker ends on the start; drop the coincident sample.
  const end = walked[walked.length - 1];
  if (samples.length > 1 && Math.hypot(end.x, end.z) < 1) samples.pop();
  return {
    id: def.id,
    samples,
    halfWidth: def.halfWidth,
    shoulder: def.shoulder,
    boundary: def.boundary,
    checkpoints: def.checkpoints ?? deriveCheckpoints(def, walked, length),
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

Update the two query functions (exact band per SPEC-M2 §4):

```ts
export function isOffTrack(pos: Vec2, track: Track): boolean {
  return nearestOnCenter(pos, track.samples).dist > track.halfWidth;
}
```

`resolveBoundary` keeps its signature `resolveBoundary(s: KartState, track: Track): boolean` (policy logic lands in Task 4).

In `src/game/trackMesh.ts` change the import and signature to `Track` (colors stay hardcoded until Task 5). In `src/game/main.ts` change:

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
git commit -m "refactor: buildTrack from TrackDef with M1 oval parity"
```

### Task 3: `validateTrackDef`

**Files:**
- Modify: `src/game/track.ts` (append)
- Modify: `src/game/track.test.ts` (append)

**Interfaces:**
- Produces: `function validateTrackDef(def: TrackDef): string[]` — empty array means valid. Enforces (SPEC-M2 §4): closure position (< 2 m) and heading (< ~5°), min arc radius ≥ 18 m on the center-line, start/finish on a straight, no self-intersection (approx point check with a cyclic skip window), and no overlapping trigger zones between non-adjacent checkpoints (override or auto-derived).

- [ ] **Step 1: Write the failing tests**

```ts
import { validateTrackDef } from './track';
import { DEFAULT_THEME, OVAL_DEF } from './tracks';
import type { TrackDef } from './track';

const BASE = {
  id: 'test',
  name: 'Test',
  halfWidth: 6,
  boundary: 'wall' as const,
  shoulder: 0,
  theme: DEFAULT_THEME,
};

describe('validateTrackDef', () => {
  it('accepts the stadium loop and the oval def', () => {
    const stadium: TrackDef = {
      ...BASE,
      path: [
        { kind: 'straight', length: 80 },
        { kind: 'arc', radius: 40, angle: Math.PI },
        { kind: 'straight', length: 80 },
        { kind: 'arc', radius: 40, angle: Math.PI },
      ],
    };
    expect(validateTrackDef(stadium)).toEqual([]);
    expect(validateTrackDef(OVAL_DEF)).toEqual([]);
  });

  it('flags an open path (position and heading)', () => {
    const def: TrackDef = {
      ...BASE,
      path: [
        { kind: 'straight', length: 80 },
        { kind: 'arc', radius: 40, angle: Math.PI },
        { kind: 'straight', length: 80 },
      ],
    };
    const errors = validateTrackDef(def);
    expect(errors.some((e) => e.includes('closure: position'))).toBe(true);
    expect(errors.some((e) => e.includes('closure: heading'))).toBe(true);
  });

  it('flags tight arcs and a non-straight start', () => {
    const def: TrackDef = {
      ...BASE,
      path: [
        { kind: 'arc', radius: 12, angle: Math.PI / 2 },
        { kind: 'straight', length: 60 },
        { kind: 'arc', radius: 40, angle: Math.PI },
      ],
    };
    const errors = validateTrackDef(def);
    expect(errors.some((e) => e.includes('radius'))).toBe(true);
    expect(errors.some((e) => e.includes('start'))).toBe(true);
  });

  it('flags a self-intersection', () => {
    // Three right-hand quarters aim the final straight back across the
    // first straight at (0, 80).
    const def: TrackDef = {
      ...BASE,
      path: [
        { kind: 'straight', length: 100 },
        { kind: 'arc', radius: 20, angle: Math.PI / 2 },
        { kind: 'arc', radius: 20, angle: Math.PI / 2 },
        { kind: 'arc', radius: 20, angle: Math.PI / 2 },
        { kind: 'straight', length: 60 },
      ],
    };
    expect(validateTrackDef(def).some((e) => e.includes('self-intersection'))).toBe(true);
  });

  it('flags overlapping trigger zones between non-adjacent checkpoints', () => {
    const def: TrackDef = {
      ...BASE,
      // cp0 (0,0,r15) and cp2 (0,25,r15): 25 m apart <= 15+15 trigger radii.
      checkpoints: [
        { x: 0, z: 0, radius: 15 },
        { x: 40, z: 120, radius: 12 },
        { x: 0, z: 25, radius: 15 },
        { x: 40, z: -40, radius: 12 },
      ],
      path: OVAL_DEF.path,
    };
    expect(validateTrackDef(def).some((e) => e.includes('checkpoints'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/game/track.test.ts`
Expected: FAIL with "validateTrackDef is not a function".

- [ ] **Step 3: Implement** (append to `src/game/track.ts`)

```ts
export function validateTrackDef(def: TrackDef): string[] {
  const errors: string[] = [];
  const { samples: walked, length } = sampleTrack(def);
  const end = walked[walked.length - 1];

  if (Math.hypot(end.x, end.z) >= 2) errors.push('closure: position gap >= 2 m');
  const TAU = Math.PI * 2;
  const wrapped = ((end.heading % TAU) + TAU) % TAU;
  if (Math.min(wrapped, TAU - wrapped) > (5 * Math.PI) / 180) {
    errors.push('closure: heading gap >= 5 deg');
  }

  for (const seg of def.path) {
    if (seg.kind === 'arc' && seg.radius < 18) errors.push(`radius: arc r=${seg.radius} < 18 m`);
  }
  if (def.path[0]?.kind !== 'straight') errors.push('start: path must begin on a straight');

  // Approx self-intersection: dense points, skip pairs that are cyclically
  // adjacent (within `window` samples along the loop), require the ribbons
  // (2 * halfWidth) plus margin to stay clear.
  const pts: Vec2[] = walked.map((p) => ({ x: p.x, z: p.z }));
  if (pts.length > 1 && Math.hypot(end.x, end.z) < 1) pts.pop();
  const minClear = 2 * def.halfWidth + 2;
  const window = Math.ceil((2 * def.halfWidth + 10) / SAMPLE_STEP);
  outer: for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const cyclic = Math.min(j - i, i + pts.length - j);
      if (cyclic <= window) continue;
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) < minClear) {
        errors.push(`self-intersection: samples ${i}/${j} closer than ${minClear} m`);
        break outer;
      }
    }
  }

  // Non-adjacent checkpoints must not overlap trigger zones (no wrong-branch
  // triggers on folded layouts).
  const cps = def.checkpoints ?? deriveCheckpoints(def, walked, length);
  for (let i = 0; i < cps.length; i++) {
    for (let j = i + 2; j < cps.length; j++) {
      if (i === 0 && j === cps.length - 1) continue; // cyclic neighbors
      const d = Math.hypot(cps[i].x - cps[j].x, cps[i].z - cps[j].z);
      if (d <= cps[i].radius + cps[j].radius) {
        errors.push(`checkpoints ${i}/${j} trigger zones overlap`);
      }
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all green.

- [ ] **Step 5: Commit**

```bash
git add src/game/track.ts src/game/track.test.ts
git commit -m "feat: add validateTrackDef for track defs"
```

### Task 4: Boundary policies (`soft` shoulders)

**Files:**
- Modify: `src/game/track.ts`
- Modify: `src/game/track.test.ts` (append)

**Interfaces:**
- Consumes: `Track` from Task 2 (already carries `boundary`, `shoulder`).
- Produces: `resolveBoundary(s: KartState, track: Track): boolean` now policy-aware — no signature change. `wall`: clamp at `halfWidth`. `soft`: free within the grass band `(halfWidth, halfWidth + shoulder]`, clamp at `halfWidth + shoulder`.

- [ ] **Step 1: Write the failing tests**

```ts
import { buildTrack, isOffTrack, nearestOnCenter, resolveBoundary } from './track';
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

  it('flags the shoulder as off-track (slowdown surface, exact band)', () => {
    const t = buildTrack(SOFT_DEF);
    expect(isOffTrack({ x: 5, z: 0 }, t)).toBe(true);
    expect(isOffTrack({ x: 4, z: 0 }, t)).toBe(false);
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

(The speed cap + drift-cancel on grass are race-loop rules; they land in Task 5's `main.ts` edit.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all green.

- [ ] **Step 5: Commit**

```bash
git add src/game/track.ts src/game/track.test.ts
git commit -m "feat: add soft boundary policy for grass shoulders"
```

### Task 5: Theme-aware `buildTrackMesh`, tangent start stripe, grass rules

**Files:**
- Modify: `src/game/trackMesh.ts`
- Modify: `src/game/main.ts`

**Interfaces:**
- Consumes: `Track` (with `theme`, `boundary`, `shoulder`, `start.heading`) from Task 2.
- Produces:
  - `function buildTrackMesh(track: Track): THREE.Group` — wall tracks: M1's 5 pieces; soft tracks: + shoulder ribbon, barriers at `halfWidth + shoulder`. Material count ≤ 6. Start stripe is a quad built from the start tangent/normal (not a hardcoded axis).
  - `function disposeGroup(group: THREE.Group): void` — disposes geometries and materials (used by Plan 04 on track switch).

- [ ] **Step 1: Implement the theme wiring and start stripe**

In `src/game/trackMesh.ts`:

1. Replace every hardcoded color with the `track.theme` field (`asphalt`, `edge`, `ground`, `barrier`; the start stripe stays white).
2. Compute the wall offset once: `const wallOffset = track.boundary === 'soft' ? track.shoulder : 0;` and build the barrier ribbons at `left(i, wallOffset)` / `right(i, wallOffset)`.
3. For `soft` tracks, add a shoulder ribbon using the same triangle-strip code as the asphalt, spanning `halfWidth .. halfWidth + shoulder` on both sides (four offset rows), colored `track.theme.shoulder`, at y `0.01`. Draw the edge lines at the asphalt edge (`extra = 0`) so the readable boundary stays the asphalt/grass line.
4. Replace the hardcoded start stripe with an explicit quad from the start frame: `f = (sin h, cos h)`, `p = (cos h, -sin h)` with `h = track.start.heading`; corners `start.pos ± p * halfWidth ± f * 0.6`, y `0.02`, white `MeshBasicMaterial` (`side: DoubleSide`), two triangles.
5. Append:

```ts
export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
```

- [ ] **Step 2: Wire sky + grass rules** in `src/game/main.ts`

1. `scene.background = new THREE.Color(track.theme.sky);` (replacing `new THREE.Color(0x111118)`).
2. Replace the off-track safety-net block with the SPEC-M2 §4 grass rules (hard cap + drift charge denied off-track; `cancelDrift` is already imported):

```ts
    // 6. Off-track rules: hard cap on the slowdown surface; grass cancels
    // drift charge / denies boost (no charging a boost off-track). For wall
    // tracks this stays unreachable behind resolveBoundary's clamp.
    if (isOffTrack(kart.pos, track)) {
      if (kart.speed > DEFAULT_PARAMS.offTrackCap) kart.speed = DEFAULT_PARAMS.offTrackCap;
      cancelDrift(kart);
    }
```

- [ ] **Step 3: Verify visually**

Run: `npm run build`, open `/play`.
Expected: identical look to M1 for the oval; background `0x111118`; start stripe across the asphalt at the start line. Then temporarily set `OVAL_DEF.boundary = 'soft'` and `shoulder = 9` locally (do not commit): grass ring around the asphalt, barriers pushed out, kart drivable onto grass with the cap, and a drift held into the grass cancels immediately. Revert after checking.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all green, build clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/trackMesh.ts src/game/main.ts
git commit -m "refactor: theme-aware track mesh with tangent start stripe"
```
