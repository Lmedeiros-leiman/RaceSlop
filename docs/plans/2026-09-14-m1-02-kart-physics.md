# M1 Plan 02 — Kart Arcade Physics (Drive + Drift + Boost)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pure arcade kart step function: accelerate/brake/steer plus drift-hold with timed boost release.

**Architecture:** Single pure function `stepKart(state, input, params, dt)` — no rendering, no DOM. All feel numbers come from `DEFAULT_PARAMS` (Plan 00). Wall contact and off-track are handled by Plan 03; this plan only owns free-driving physics.

**Tech Stack:** TypeScript (strict), vitest.

**Spec:** `docs/SPEC-M1.md` §3 (numbers), §4 (drift/boost rules).

## Global Constraints

- TypeScript strict mode, no `any` in game code.
- No external physics engine, ever.
- Forward is `(sin(heading), cos(heading))`; heading increases clockwise when seen from above with positive steer (right).
- Boost tiers verbatim from spec: <0.5s none, 0.5–1.5s small (`boostSmall` × `boostSmallTime`), >1.5s full (capped, longer holds do not stack).
- Wall contact cancels drift charge with no boost (enforced by Plan 03 calling the exported `cancelDrift`).
- `npm run build` must stay green.

---

### Task 1: Longitudinal + steering

**Files:**
- Create: `src/game/kart.ts`
- Create: `src/game/kart.test.ts`

**Interfaces:**
- Consumes: `DriveInput`, `KartParams`, `KartState`, `DEFAULT_PARAMS` from `./types`.
- Produces (exact names, used by Plans 03–04):
  - `function stepKart(s: KartState, input: DriveInput, p: KartParams, dt: number): void`
  - `function cancelDrift(s: KartState): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { stepKart } from './kart';
import { DEFAULT_PARAMS, createKartState } from './types';

const idle = { throttle: false, brake: false, steer: 0, drift: false };

describe('longitudinal', () => {
  it('reaches near top speed in ~3s of throttle', () => {
    const s = createKartState(0, 0, 0);
    for (let i = 0; i < 200; i++) stepKart(s, { ...idle, throttle: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.speed).toBeLessThanOrEqual(DEFAULT_PARAMS.topSpeed);
    expect(s.speed).toBeGreaterThan(27);
  });

  it('brakes from top speed and then reverses', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 120; i++) stepKart(s, { ...idle, brake: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.speed).toBeLessThanOrEqual(0);
    expect(s.speed).toBeGreaterThanOrEqual(-DEFAULT_PARAMS.reverseMax);
  });

  it('moves forward along heading', () => {
    const s = createKartState(0, 0, 0);
    stepKart(s, { ...idle, throttle: true }, DEFAULT_PARAMS, 1);
    expect(s.pos.z).toBeGreaterThan(0);
    expect(s.pos.x).toBeCloseTo(0, 6);
  });
});

describe('steering', () => {
  it('yaws right with positive steer while moving', () => {
    const s = createKartState(0, 0, 0);
    s.speed = 20;
    stepKart(s, { ...idle, steer: 1 }, DEFAULT_PARAMS, 1);
    expect(s.heading).toBeCloseTo(DEFAULT_PARAMS.steerRate, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/kart.test.ts`
Expected: FAIL with "Failed to resolve import './kart'".

- [ ] **Step 3: Write minimal implementation (no drift yet)**

```ts
import type { DriveInput, KartParams, KartState } from './types';

export function cancelDrift(s: KartState): void {
  s.drifting = false;
  s.driftTime = 0;
  s.driftAngle = 0;
}

export function stepKart(s: KartState, input: DriveInput, p: KartParams, dt: number): void {
  if (dt <= 0) return;

  if (s.boostTime > 0) s.boostTime -= dt;
  const maxSpeed = s.boostTime > 0 ? p.topSpeed * s.boostMult : p.topSpeed;

  if (input.throttle) {
    const cap = s.drifting ? maxSpeed * p.driftBleed : maxSpeed;
    s.speed = Math.min(s.speed + p.accelRate * dt, cap);
  } else if (input.brake) {
    if (s.speed > 0.5) {
      s.speed = Math.max(0, s.speed - p.brakeDecel * dt);
    } else {
      s.speed = Math.max(-p.reverseMax, s.speed - p.accelRate * 0.6 * dt);
    }
  } else {
    const drag = 4 * dt;
    s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), drag);
  }

  const dir = s.speed >= 0 ? 1 : -1;
  s.heading += input.steer * p.steerRate * dir * dt;

  const moveDir = s.heading + s.driftAngle;
  s.pos.x += Math.sin(moveDir) * s.speed * dt;
  s.pos.z += Math.cos(moveDir) * s.speed * dt;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/game/kart.test.ts`
Expected: PASS, 4 tests.

### Task 2: Drift hold + boost release

**Files:**
- Modify: `src/game/kart.ts`
- Modify: `src/game/kart.test.ts` (append new describe block)

**Interfaces:**
- Same as Task 1, no new exports.

- [ ] **Step 1: Write the failing tests**

```ts
describe('drift and boost', () => {
  it('holds drift angle while drifting', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 60; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    expect(s.drifting).toBe(true);
    expect(s.driftAngle).toBeCloseTo(DEFAULT_PARAMS.driftMaxAngle, 1);
  });

  it('grants full boost after a long drift', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 120; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: false }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(false);
    expect(s.boostTime).toBeCloseTo(DEFAULT_PARAMS.boostFullTime, 1);
  });

  it('grants no boost for a tap under 0.5s', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 10; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: false }, DEFAULT_PARAMS, 1 / 60);
    expect(s.boostTime).toBeLessThanOrEqual(0);
  });

  it('does not drift below minimum speed', () => {
    const s = createKartState(0, 0, 0);
    s.speed = 5;
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/game/kart.test.ts`
Expected: FAIL (drifting never becomes true).

- [ ] **Step 3: Add drift logic to stepKart**

Insert before the steering block in `stepKart`:

```ts
  const canDrift = s.speed > p.topSpeed * p.driftMinSpeed;
  if (input.drift && canDrift && input.steer !== 0) {
    if (!s.drifting) {
      s.drifting = true;
      s.driftTime = 0;
    }
    s.driftTime += dt;
    const target = p.driftMaxAngle * Math.sign(input.steer);
    s.driftAngle += (target - s.driftAngle) * Math.min(1, 10 * dt);
  } else if (s.drifting) {
    if (s.driftTime > 1.5) {
      s.boostMult = p.boostFull;
      s.boostTime = p.boostFullTime;
    } else if (s.driftTime >= 0.5) {
      s.boostMult = p.boostSmall;
      s.boostTime = p.boostSmallTime;
    }
    cancelDrift(s);
  }
```

And scale yaw while drifting — change the heading line to:

```ts
  s.heading += input.steer * p.steerRate * dir * dt * (s.drifting ? 0.8 : 1);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all kart tests green.

- [ ] **Step 5: Commit**

```bash
git add src/game/kart.ts src/game/kart.test.ts
git commit -m "feat: add arcade kart physics with drift boost"
```
