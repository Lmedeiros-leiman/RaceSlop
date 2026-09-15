# M1 Plan 00 — Test Harness + Shared Types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install vitest and create the shared game types every later plan imports.

**Architecture:** Pure TypeScript modules under `src/game/` with zero DOM/Three.js imports, so all game logic is unit-testable under node. Rendering stays in `main.ts` / `GameCanvas.astro` only.

**Tech Stack:** TypeScript (strict), vitest, Three.js (render only, not in this plan).

**Spec:** `docs/SPEC-M1.md` (§3 defaults, §10 structure).

## Global Constraints

- TypeScript strict mode, no `any` in game code.
- No external physics engine, ever.
- Game modules must not touch `window`/`document` at import time (client-only runs via `GameCanvas.astro` script).
- Physics defaults and tuning ranges are copied verbatim from `docs/SPEC-M1.md` §3.
- `npm run build` (Astro static) must stay green after every plan.

---

### Task 1: Install vitest and add test script

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs vitest once (`vitest run`).

- [ ] **Step 1: Add vitest + config**

Create `vitest.config.ts` at repo root:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

In `package.json`, add devDependency `"vitest": "^3"` and script `"test": "vitest run"`. Run `npm install --no-audit --no-fund`.

- [ ] **Step 2: Verify the runner works with zero tests**

Run: `npm test`
Expected: PASS with "No test files found" (exit 0).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest harness for game logic"
```

---

### Task 2: Shared types + defaults

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/types.test.ts`

**Interfaces:**
- Consumes: SPEC-M1 §3 numbers.
- Produces (exact names, used by Plans 01–04):
  - `interface Vec2 { x: number; z: number }`
  - `interface KartParams { topSpeed; accelRate; brakeDecel; reverseMax; steerRate; driftMinSpeed; driftMaxAngle; driftBleed; boostSmall; boostSmallTime; boostFull; boostFullTime; offTrackCap }` (all `number`)
  - `const DEFAULT_PARAMS: KartParams`
  - `interface KartState { pos: Vec2; heading: number; speed: number; driftAngle: number; drifting: boolean; driftTime: number; boostTime: number; boostMult: number }`
  - `function createKartState(x: number, z: number, heading: number): KartState`
  - `interface RawInput { throttle: boolean; brake: boolean; left: boolean; right: boolean; drift: boolean; reset: boolean; restart: boolean }`
  - `interface DriveInput { throttle: boolean; brake: boolean; steer: number; drift: boolean }`
  - `function createRawInput(): RawInput`
  - `function toDriveInput(r: RawInput): DriveInput`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, createKartState, createRawInput, toDriveInput } from './types';

describe('shared types', () => {
  it('defaults match SPEC-M1 §3', () => {
    expect(DEFAULT_PARAMS.topSpeed).toBe(28);
    expect(DEFAULT_PARAMS.brakeDecel).toBe(30);
    expect(DEFAULT_PARAMS.reverseMax).toBe(8);
    expect(DEFAULT_PARAMS.steerRate).toBe(2.2);
    expect(DEFAULT_PARAMS.offTrackCap).toBe(12);
  });

  it('creates a parked kart', () => {
    const s = createKartState(1, 2, Math.PI / 2);
    expect(s.pos).toEqual({ x: 1, z: 2 });
    expect(s.speed).toBe(0);
    expect(s.drifting).toBe(false);
  });

  it('derives steer from left/right', () => {
    const r = createRawInput();
    r.right = true;
    expect(toDriveInput(r).steer).toBe(1);
    r.left = true;
    expect(toDriveInput(r).steer).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Failed to resolve import './types'".

- [ ] **Step 3: Write minimal implementation**

```ts
export interface Vec2 {
  x: number;
  z: number;
}

export interface KartParams {
  topSpeed: number;
  accelRate: number;
  brakeDecel: number;
  reverseMax: number;
  steerRate: number;
  driftMinSpeed: number;
  driftMaxAngle: number;
  driftBleed: number;
  boostSmall: number;
  boostSmallTime: number;
  boostFull: number;
  boostFullTime: number;
  offTrackCap: number;
}

// Defaults from SPEC-M1 §3. Tune only inside spec ranges.
export const DEFAULT_PARAMS: KartParams = {
  topSpeed: 28,
  accelRate: 28 / 3,
  brakeDecel: 30,
  reverseMax: 8,
  steerRate: 2.2,
  driftMinSpeed: 0.4,
  driftMaxAngle: Math.PI / 6,
  driftBleed: 0.93,
  boostSmall: 1.15,
  boostSmallTime: 0.6,
  boostFull: 1.25,
  boostFullTime: 1.0,
  offTrackCap: 12,
};

export interface KartState {
  pos: Vec2;
  heading: number;
  speed: number;
  driftAngle: number;
  drifting: boolean;
  driftTime: number;
  boostTime: number;
  boostMult: number;
}

export function createKartState(x: number, z: number, heading: number): KartState {
  return {
    pos: { x, z },
    heading,
    speed: 0,
    driftAngle: 0,
    drifting: false,
    driftTime: 0,
    boostTime: 0,
    boostMult: 1,
  };
}

export interface RawInput {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  reset: boolean;
  restart: boolean;
}

export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  steer: number;
  drift: boolean;
}

export function createRawInput(): RawInput {
  return { throttle: false, brake: false, left: false, right: false, drift: false, reset: false, restart: false };
}

export function toDriveInput(r: RawInput): DriveInput {
  const steer = (r.right ? 1 : 0) - (r.left ? 1 : 0);
  return { throttle: r.throttle, brake: r.brake, steer, drift: r.drift };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/types.test.ts
git commit -m "feat: add shared kart/input types with spec defaults"
```
