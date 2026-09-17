import { describe, expect, it } from 'vitest';
import { buildTrack } from './track';
import { FOREST_DEF, OVAL_DEF } from './tracks';
import {
  clearMinimapCache,
  computeProjection,
  drawMinimap,
  MINIMAP_SIZE,
  projectPoint,
  type MinimapCtx,
} from './minimap';

interface FakeCtx extends MinimapCtx {
  calls: string[];
  arcAt: { x: number; y: number } | null;
}

function fakeCtx(): FakeCtx {
  const fake = {
    calls: [] as string[],
    arcAt: null as { x: number; y: number } | null,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect(): void {
      fake.calls.push('clear');
    },
    beginPath(): void {
      fake.calls.push('begin');
    },
    moveTo(): void {
      fake.calls.push('move');
    },
    lineTo(): void {
      fake.calls.push('line');
    },
    closePath(): void {
      fake.calls.push('close');
    },
    stroke(): void {
      fake.calls.push('stroke');
    },
    arc(x: number, y: number): void {
      fake.calls.push('arc');
      fake.arcAt = { x, y };
    },
    fill(): void {
      fake.calls.push('fill');
    },
  };
  return fake;
}

describe('computeProjection', () => {
  it('fits every sample inside the padded square', () => {
    const t = buildTrack(FOREST_DEF);
    const proj = computeProjection(t.samples, MINIMAP_SIZE);
    for (const p of t.samples) {
      const q = projectPoint(p, proj);
      expect(q.x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(q.x).toBeLessThanOrEqual(MINIMAP_SIZE - 10 + 1e-6);
      expect(q.y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(q.y).toBeLessThanOrEqual(MINIMAP_SIZE - 10 + 1e-6);
    }
  });

  it('points world +z up, so the kart starts facing up', () => {
    const t = buildTrack(OVAL_DEF);
    const proj = computeProjection(t.samples, MINIMAP_SIZE);
    const a = projectPoint({ x: 0, z: 0 }, proj);
    const b = projectPoint({ x: 0, z: 10 }, proj);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeLessThan(a.y);
  });
});

describe('drawMinimap', () => {
  it('strokes the closed track loop and dots the kart position', () => {
    clearMinimapCache();
    const t = buildTrack(OVAL_DEF);
    const ctx = fakeCtx();
    drawMinimap(ctx, t, t.start.pos);
    expect(ctx.calls[0]).toBe('clear');
    expect(ctx.calls).toContain('close');
    expect(ctx.calls).toContain('stroke');
    expect(ctx.calls.filter((c) => c === 'line').length).toBe(t.samples.length - 1);
    expect(ctx.strokeStyle).toBe('#ff5533');
    // Player dot lands on the projected start pos.
    const proj = computeProjection(t.samples, MINIMAP_SIZE);
    const q = projectPoint(t.start.pos, proj);
    expect(ctx.arcAt?.x).toBeCloseTo(q.x, 6);
    expect(ctx.arcAt?.y).toBeCloseTo(q.y, 6);
    expect(ctx.fillStyle).toBe('#ffffff');
  });

  it('tracks the kart as it moves', () => {
    clearMinimapCache();
    const t = buildTrack(OVAL_DEF);
    const ctx = fakeCtx();
    drawMinimap(ctx, t, { x: 30, z: 60 });
    const proj = computeProjection(t.samples, MINIMAP_SIZE);
    const q = projectPoint({ x: 30, z: 60 }, proj);
    expect(ctx.arcAt?.x).toBeCloseTo(q.x, 6);
    expect(ctx.arcAt?.y).toBeCloseTo(q.y, 6);
  });
});
