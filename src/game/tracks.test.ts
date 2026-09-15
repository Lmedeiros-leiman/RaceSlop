import { describe, expect, it } from 'vitest';
import { buildTrack, isOffTrack, resolveBoundary, sampleTrack, validateTrackDef } from './track';
import { CIRCUIT_DEF, PARK_DEF } from './tracks';
import { createKartState } from './types';

describe('circuit def', () => {
  it('matches the SPEC-M2 §5 targets', () => {
    expect(CIRCUIT_DEF.id).toBe('circuit');
    expect(CIRCUIT_DEF.halfWidth).toBe(6);
    expect(CIRCUIT_DEF.boundary).toBe('wall');
    const len = sampleTrack(CIRCUIT_DEF).length;
    expect(len).toBeGreaterThan(650);
    expect(len).toBeLessThan(750);
  });

  it('passes validateTrackDef', () => {
    expect(validateTrackDef(CIRCUIT_DEF)).toEqual([]);
  });

  it('starts on a straight, closes, and derives 8 checkpoints', () => {
    expect(CIRCUIT_DEF.path[0].kind).toBe('straight');
    const t = buildTrack(CIRCUIT_DEF);
    expect(t.samples.length).toBeGreaterThan(200);
    expect(t.checkpoints).toHaveLength(8);
    const tail = t.samples[t.samples.length - 1];
    expect(Math.hypot(tail.x, tail.z)).toBeLessThan(4);
    expect(t.start.heading).toBe(0);
  });
});

describe('park def', () => {
  it('matches the SPEC-M2 §5 targets', () => {
    expect(PARK_DEF.id).toBe('park');
    expect(PARK_DEF.halfWidth).toBe(4.5);
    expect(PARK_DEF.boundary).toBe('soft');
    expect(PARK_DEF.shoulder).toBe(9);
    const len = sampleTrack(PARK_DEF).length;
    expect(len).toBeGreaterThan(600);
    expect(len).toBeLessThan(900);
  });

  it('passes validateTrackDef', () => {
    expect(validateTrackDef(PARK_DEF)).toEqual([]);
  });

  it('starts on a straight, closes, and derives 8 checkpoints', () => {
    expect(PARK_DEF.path[0].kind).toBe('straight');
    const t = buildTrack(PARK_DEF);
    expect(t.samples.length).toBeGreaterThan(200);
    expect(t.checkpoints).toHaveLength(8);
    const tail = t.samples[t.samples.length - 1];
    expect(Math.hypot(tail.x, tail.z)).toBeLessThan(4);
    expect(t.start.heading).toBe(0);
  });

  it('uses the exact grass band beside the start straight', () => {
    const t = buildTrack(PARK_DEF);
    // Start straight runs x=0, z in [0, 100]; (8, 50) sits on the grass.
    expect(isOffTrack({ x: 8, z: 50 }, t)).toBe(true);
    const s = createKartState(8, 50, 0);
    expect(resolveBoundary(s, t)).toBe(false);
    expect(s.pos.x).toBe(8);
  });
});
