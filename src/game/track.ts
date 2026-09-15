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

import { cancelDrift } from './kart';
import type { KartState, Vec2 } from './types';

export interface Checkpoint {
  x: number;
  z: number;
  radius: number;
}

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

export function nearestOnCenter(pos: Vec2, samples: Vec2[]): { dist: number; x: number; z: number } {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i++) {
    const d = Math.hypot(pos.x - samples[i].x, pos.z - samples[i].z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { dist: bestD, x: samples[best].x, z: samples[best].z };
}

export function isOffTrack(pos: Vec2, track: Track): boolean {
  return nearestOnCenter(pos, track.samples).dist > track.halfWidth;
}

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

export class LapTracker {
  private next = 1;
  private lapStart = 0;
  private started = false;
  current = 0;
  last: number | null = null;
  best: number | null = null;

  constructor(private readonly cps: Checkpoint[]) {}

  reset(now: number): void {
    this.next = 1;
    this.lapStart = now;
    this.started = true;
    this.current = 0;
  }

  invalidate(now: number): void {
    this.next = 1;
    this.lapStart = now;
    this.current = 0;
  }

  update(pos: Vec2, now: number): { lap: number | null } {
    if (!this.started) return { lap: null };
    this.current = now - this.lapStart;
    const cp = this.cps[this.next];
    if (Math.hypot(pos.x - cp.x, pos.z - cp.z) < cp.radius) {
      if (this.next === 0) {
        const lap = this.current;
        this.last = lap;
        if (this.best === null || lap < this.best) this.best = lap;
        this.next = 1;
        this.lapStart = now;
        this.current = 0;
        return { lap };
      }
      this.next = (this.next + 1) % this.cps.length;
    }
    return { lap: null };
  }
}

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
