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
