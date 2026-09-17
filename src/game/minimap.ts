import type { Track } from './track';
import type { Vec2 } from './types';

// Top-down minimap: pure projection math (unit-tested) plus a thin canvas
// renderer driven by a structural ctx so tests can pass a recording fake
// (vitest runs in node, no DOM canvas available).

export interface MinimapProjection {
  minX: number;
  minZ: number;
  scale: number;
  pad: number;
  size: number;
}

export function computeProjection(samples: Vec2[], size: number, pad = 10): MinimapProjection {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of samples) {
    if (p.x < minX) minX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.z > maxZ) maxZ = p.z;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxZ - minZ);
  const scale = Math.min((size - 2 * pad) / w, (size - 2 * pad) / h);
  return { minX, minZ, scale, pad, size };
}

// World +z points up on the minimap, so the kart starts facing up.
export function projectPoint(p: Vec2, proj: MinimapProjection): { x: number; y: number } {
  return {
    x: proj.pad + (p.x - proj.minX) * proj.scale,
    y: proj.size - proj.pad - (p.z - proj.minZ) * proj.scale,
  };
}

// Minimal 2D ctx surface used by drawMinimap; a real
// CanvasRenderingContext2D satisfies this structurally.
export interface MinimapCtx {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  stroke(): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  fill(): void;
}

export const MINIMAP_SIZE = 140;
const DOT_R = 4;

const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

const projCache = new Map<string, MinimapProjection>();

export function drawMinimap(ctx: MinimapCtx, track: Track, kart: Vec2, size = MINIMAP_SIZE): void {
  const key = `${track.id}@${size}`;
  let proj = projCache.get(key);
  if (!proj) {
    proj = computeProjection(track.samples, size);
    projCache.set(key, proj);
  }
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = css(track.theme.edge);
  ctx.lineWidth = 3;
  ctx.beginPath();
  track.samples.forEach((p, i) => {
    const q = projectPoint(p, proj);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.stroke();
  const k = projectPoint(kart, proj);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(k.x, k.y, DOT_R, 0, Math.PI * 2);
  ctx.fill();
}

export function clearMinimapCache(): void {
  projCache.clear();
}
