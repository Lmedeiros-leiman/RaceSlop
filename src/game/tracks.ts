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

// Track 2 — technical circuit. Point-symmetric halves: S-chicane (r30/r20)
// into a sweeper, net heading π per half. 2 x (170 m straight + chicane +
// 60 m straight + r40) = ~717 m. Start/finish mid-straight (0, 0) facing +z.
export const CIRCUIT_DEF: TrackDef = {
  id: 'circuit',
  name: 'Technical Circuit',
  halfWidth: 6,
  boundary: 'wall',
  shoulder: 0,
  theme: {
    sky: 0x14181e,
    asphalt: 0x43474f,
    edge: 0xffd23f,
    shoulder: 0x2a4a2e,
    ground: 0x2b3a2b,
    barrier: 0xd9483b,
  },
  path: [
    { kind: 'straight', length: 70 },
    { kind: 'arc', radius: 30, angle: Math.PI / 2 },
    { kind: 'straight', length: 20 },
    { kind: 'arc', radius: 20, angle: -Math.PI / 2 },
    { kind: 'straight', length: 20 },
    { kind: 'arc', radius: 30, angle: Math.PI / 2 },
    { kind: 'straight', length: 60 },
    { kind: 'arc', radius: 40, angle: Math.PI / 2 },
    { kind: 'straight', length: 70 },
    { kind: 'arc', radius: 30, angle: Math.PI / 2 },
    { kind: 'straight', length: 20 },
    { kind: 'arc', radius: 20, angle: -Math.PI / 2 },
    { kind: 'straight', length: 20 },
    { kind: 'arc', radius: 30, angle: Math.PI / 2 },
    { kind: 'straight', length: 60 },
    { kind: 'arc', radius: 40, angle: Math.PI / 2 },
  ],
};

// Track 3 — off-road park. Narrow asphalt, grass shoulders (soft), gentle
// 45° S-kinks (opposite-signed pair, net heading π per half) = ~678 m.
// Start/finish mid-straight (0, 0) facing +z.
export const PARK_DEF: TrackDef = {
  id: 'park',
  name: 'Off-road Park',
  halfWidth: 4.5,
  boundary: 'soft',
  shoulder: 9,
  theme: {
    sky: 0x1c2b20,
    asphalt: 0x4f5747,
    edge: 0xffffff,
    shoulder: 0x3a6b35,
    ground: 0x2c4a28,
    barrier: 0x8a6b3a,
  },
  path: [
    { kind: 'straight', length: 100 },
    { kind: 'arc', radius: 40, angle: Math.PI / 2 },
    { kind: 'straight', length: 30 },
    { kind: 'arc', radius: 18, angle: Math.PI / 4 },
    { kind: 'straight', length: 25 },
    { kind: 'arc', radius: 18, angle: -Math.PI / 4 },
    { kind: 'straight', length: 30 },
    { kind: 'arc', radius: 40, angle: Math.PI / 2 },
    { kind: 'straight', length: 100 },
    { kind: 'arc', radius: 40, angle: Math.PI / 2 },
    { kind: 'straight', length: 30 },
    { kind: 'arc', radius: 18, angle: Math.PI / 4 },
    { kind: 'straight', length: 25 },
    { kind: 'arc', radius: 18, angle: -Math.PI / 4 },
    { kind: 'straight', length: 30 },
    { kind: 'arc', radius: 40, angle: Math.PI / 2 },
  ],
};
