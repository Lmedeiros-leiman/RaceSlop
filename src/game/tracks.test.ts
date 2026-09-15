import { describe, expect, it } from 'vitest';
import { buildTrack, sampleTrack, validateTrackDef } from './track';
import { CIRCUIT_DEF } from './tracks';

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
