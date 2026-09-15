import { describe, expect, it } from 'vitest';
import { computeChasePose } from './camera';

describe('computeChasePose', () => {
  it('sits behind and above, looking ahead', () => {
    const pose = computeChasePose({ x: 10, z: 20 }, 0);
    expect(pose.camX).toBeCloseTo(10, 6);
    expect(pose.camY).toBeCloseTo(3, 6);
    expect(pose.camZ).toBeCloseTo(14, 6);
    expect(pose.lookX).toBeCloseTo(10, 6);
    expect(pose.lookZ).toBeCloseTo(24, 6);
  });
});
