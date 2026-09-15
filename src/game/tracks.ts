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
