import { cancelDrift } from './kart';
import type { KartState, Vec2 } from './types';

export interface Checkpoint {
  x: number;
  z: number;
  radius: number;
}

export interface OvalTrack {
  samples: Vec2[];
  halfWidth: number;
  checkpoints: Checkpoint[];
  start: { pos: Vec2; heading: number };
}

const HALF_STRAIGHT = 40;
const RADIUS = 40;

export function buildOval(): OvalTrack {
  const straightLen = 2 * HALF_STRAIGHT;
  const total = 2 * straightLen + 2 * Math.PI * RADIUS;
  const n = 256;
  const samples: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const d0 = (i / n) * total;
    let p: Vec2;
    if (d0 < straightLen) {
      p = { x: -HALF_STRAIGHT + d0, z: -RADIUS };
    } else if (d0 - straightLen < Math.PI * RADIUS) {
      const a = -Math.PI / 2 + (d0 - straightLen) / RADIUS;
      p = { x: HALF_STRAIGHT + Math.cos(a) * RADIUS, z: Math.sin(a) * RADIUS };
    } else if (d0 - straightLen - Math.PI * RADIUS < straightLen) {
      const d = d0 - straightLen - Math.PI * RADIUS;
      p = { x: HALF_STRAIGHT - d, z: RADIUS };
    } else {
      const d = d0 - straightLen - Math.PI * RADIUS - straightLen;
      const a = Math.PI / 2 + d / RADIUS;
      p = { x: -HALF_STRAIGHT + Math.cos(a) * RADIUS, z: Math.sin(a) * RADIUS };
    }
    samples.push(p);
  }
  const checkpoints: Checkpoint[] = [
    { x: 0, z: -RADIUS, radius: 10 },
    { x: HALF_STRAIGHT + RADIUS, z: 0, radius: 12 },
    { x: 0, z: RADIUS, radius: 10 },
    { x: -HALF_STRAIGHT - RADIUS, z: 0, radius: 12 },
  ];
  return {
    samples,
    halfWidth: 6,
    checkpoints,
    start: { pos: { x: 0, z: -RADIUS }, heading: Math.PI / 2 },
  };
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

export function isOffTrack(pos: Vec2, track: OvalTrack): boolean {
  return nearestOnCenter(pos, track.samples).dist > track.halfWidth + 2;
}

export function resolveBoundary(s: KartState, track: OvalTrack): boolean {
  const near = nearestOnCenter(s.pos, track.samples);
  if (near.dist <= track.halfWidth) return false;
  const over = near.dist - track.halfWidth;
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
