import type { DriveInput, KartParams, KartState } from './types';

export function cancelDrift(s: KartState): void {
  s.drifting = false;
  s.driftTime = 0;
  s.driftAngle = 0;
}

export function stepKart(s: KartState, input: DriveInput, p: KartParams, dt: number): void {
  if (dt <= 0) return;

  if (s.boostTime > 0) s.boostTime -= dt;
  const maxSpeed = s.boostTime > 0 ? p.topSpeed * s.boostMult : p.topSpeed;

  if (input.throttle) {
    const cap = s.drifting ? maxSpeed * p.driftBleed : maxSpeed;
    s.speed = Math.min(s.speed + p.accelRate * dt, cap);
  } else if (input.brake) {
    if (s.speed > 0.5) {
      s.speed = Math.max(0, s.speed - p.brakeDecel * dt);
    } else {
      s.speed = Math.max(-p.reverseMax, s.speed - p.accelRate * 0.6 * dt);
    }
  } else {
    const drag = 4 * dt;
    s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), drag);
  }

  const canDrift = s.speed > p.topSpeed * p.driftMinSpeed;
  if (input.drift && canDrift && input.steer !== 0) {
    if (!s.drifting) {
      s.drifting = true;
      s.driftTime = 0;
    }
    s.driftTime += dt;
    const target = p.driftMaxAngle * Math.sign(input.steer);
    s.driftAngle += (target - s.driftAngle) * Math.min(1, 10 * dt);
  } else if (s.drifting) {
    if (canDrift) {
      if (s.driftTime > 1.5) {
        s.boostMult = p.boostFull;
        s.boostTime = p.boostFullTime;
      } else if (s.driftTime >= 0.5) {
        s.boostMult = p.boostSmall;
        s.boostTime = p.boostSmallTime;
      }
    }
    cancelDrift(s);
  }

  const dir = s.speed >= 0 ? 1 : -1;
  // Facing +z at heading 0, world +x is to the driver's left, so a
  // positive (right) steer must decrease heading. Keep partial authority
  // at standstill so a kart pinned head-on into a wall can still turn away.
  const lowSpeedScale = 0.4 + 0.6 * Math.min(1, Math.abs(s.speed) / 4);
  s.heading -= input.steer * p.steerRate * dir * dt * (s.drifting ? 0.8 : 1) * lowSpeedScale;

  const moveDir = s.heading + s.driftAngle;
  s.pos.x += Math.sin(moveDir) * s.speed * dt;
  s.pos.z += Math.cos(moveDir) * s.speed * dt;
}
