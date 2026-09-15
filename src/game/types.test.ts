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
