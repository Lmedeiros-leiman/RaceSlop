import { describe, expect, it } from 'vitest';
import { buildTrack, isOffTrack, LapTracker, minRadius, nearestOnCenter, pathLength, resolveBoundary, samplePath } from './track';
import { OVAL_DEF } from './tracks';
import { createKartState } from './types';

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

describe('LapTracker', () => {
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

  it('ignores the line when checkpoints are skipped', () => {
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

  it('ignores the line when checkpoints are skipped', () => {
    const t = buildTrack(OVAL_DEF);
    const tracker = new LapTracker(t.checkpoints);
    tracker.reset(0);
    const r = tracker.update({ x: t.checkpoints[0].x, z: t.checkpoints[0].z }, 10);
    expect(r.lap).toBeNull();
    expect(tracker.last).toBeNull();
  });

  it('invalidate restarts the current lap without recording', () => {
    const t = buildTrack(OVAL_DEF);
    const tracker = new LapTracker(t.checkpoints);
    tracker.reset(0);
    tracker.update({ x: t.checkpoints[1].x, z: t.checkpoints[1].z }, 5);
    tracker.invalidate(7);
    expect(tracker.current).toBe(0);
    expect(tracker.last).toBeNull();
  });
});
