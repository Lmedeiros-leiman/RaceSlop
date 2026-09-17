import { describe, expect, it } from 'vitest';
import { stepKart } from './kart';
import { DEFAULT_PARAMS, createKartState } from './types';

const idle = { throttle: false, brake: false, steer: 0, drift: false };

describe('longitudinal', () => {
  it('reaches near top speed in ~3s of throttle', () => {
    const s = createKartState(0, 0, 0);
    for (let i = 0; i < 200; i++) stepKart(s, { ...idle, throttle: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.speed).toBeLessThanOrEqual(DEFAULT_PARAMS.topSpeed);
    expect(s.speed).toBeGreaterThan(27);
  });

  it('brakes from top speed and then reverses', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 120; i++) stepKart(s, { ...idle, brake: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.speed).toBeLessThanOrEqual(0);
    expect(s.speed).toBeGreaterThanOrEqual(-DEFAULT_PARAMS.reverseMax);
  });

  it('moves forward along heading', () => {
    const s = createKartState(0, 0, 0);
    stepKart(s, { ...idle, throttle: true }, DEFAULT_PARAMS, 1);
    expect(s.pos.z).toBeGreaterThan(0);
    expect(s.pos.x).toBeCloseTo(0, 6);
  });
});

describe('steering', () => {
  it('yaws right (negative heading) with positive steer while moving', () => {
    const s = createKartState(0, 0, 0);
    s.speed = 20;
    stepKart(s, { ...idle, steer: 1 }, DEFAULT_PARAMS, 1);
    expect(s.heading).toBeCloseTo(-DEFAULT_PARAMS.steerRate, 6);
  });

  it('yaws left with negative steer while moving', () => {
    const s = createKartState(0, 0, 0);
    s.speed = 20;
    stepKart(s, { ...idle, steer: -1 }, DEFAULT_PARAMS, 1);
    expect(s.heading).toBeCloseTo(DEFAULT_PARAMS.steerRate, 6);
  });

  it('keeps partial steer authority at standstill to escape walls', () => {
    const s = createKartState(0, 0, 0);
    s.speed = 0;
    stepKart(s, { ...idle, steer: 1 }, DEFAULT_PARAMS, 1);
    expect(s.heading).toBeCloseTo(-DEFAULT_PARAMS.steerRate * 0.4, 6);
  });
});

describe('drift and boost', () => {
  it('holds drift angle while drifting', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 60; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    expect(s.drifting).toBe(true);
    expect(s.driftAngle).toBeCloseTo(DEFAULT_PARAMS.driftMaxAngle, 1);
  });

  it('kicks laterally toward the outside on drift initiate', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(true);
    // Right turn from +z: outside is +x. Must read as a shove, not a mode flip.
    expect(s.pos.x).toBeGreaterThan(0.2);
  });

  it('eases the drift angle back on release instead of snapping', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 120; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: false }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(false);
    expect(s.driftAngle).toBeGreaterThan(0.2);
    for (let i = 0; i < 120; i++) {
      stepKart(s, { ...idle, throttle: true }, DEFAULT_PARAMS, 1 / 60);
    }
    expect(s.driftAngle).toBe(0);
  });

  it('grants full boost after a long drift', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 120; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: false }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(false);
    expect(s.boostTime).toBeCloseTo(DEFAULT_PARAMS.boostFullTime, 1);
  });

  it('grants no boost for a tap under 0.5s', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 10; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: false }, DEFAULT_PARAMS, 1 / 60);
    expect(s.boostTime).toBeLessThanOrEqual(0);
  });

  it('does not drift below minimum speed', () => {
    const s = createKartState(0, 0, 0);
    s.speed = 5;
    stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(false);
  });

  it('braking below drift speed mid-drift cancels with no boost', () => {
    const s = createKartState(0, 0, 0);
    s.speed = DEFAULT_PARAMS.topSpeed;
    for (let i = 0; i < 100; i++) {
      stepKart(s, { throttle: true, brake: false, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    expect(s.drifting).toBe(true);
    for (let i = 0; i < 300 && s.speed >= DEFAULT_PARAMS.topSpeed * 0.4; i++) {
      stepKart(s, { throttle: false, brake: true, steer: 1, drift: true }, DEFAULT_PARAMS, 1 / 60);
    }
    expect(s.speed).toBeLessThan(DEFAULT_PARAMS.topSpeed * 0.4);
    stepKart(s, { throttle: false, brake: true, steer: 1, drift: false }, DEFAULT_PARAMS, 1 / 60);
    expect(s.drifting).toBe(false);
    expect(s.boostTime).toBeLessThanOrEqual(0);
  });
});
