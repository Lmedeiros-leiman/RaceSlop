import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildKartMesh, CHARACTERS } from './characters';

describe('CHARACTERS', () => {
  it('has exactly 4 slots with unique ids', () => {
    expect(CHARACTERS).toHaveLength(4);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(4);
  });

  it('gives every character a distinct body palette', () => {
    const bodies = new Set(CHARACTERS.map((c) => c.body));
    expect(bodies.size).toBe(4);
  });

  it('keeps silhouettes positive and within 25% of stock', () => {
    for (const c of CHARACTERS) {
      const { width, height, length } = c.silhouette;
      for (const v of [width, height, length]) {
        expect(v).toBeGreaterThan(0.75);
        expect(v).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it('uses non-empty placeholder names', () => {
    for (const c of CHARACTERS) {
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
});

describe('buildKartMesh', () => {
  it('applies the def palette to body and nose', () => {
    for (const c of CHARACTERS) {
      const mesh = buildKartMesh(c);
      const body = mesh.getObjectByName('body') as THREE.Mesh;
      const nose = mesh.getObjectByName('nose') as THREE.Mesh;
      expect((body.material as THREE.MeshStandardMaterial).color.getHex()).toBe(c.body);
      expect((nose.material as THREE.MeshStandardMaterial).color.getHex()).toBe(c.accent);
    }
  });

  it('keeps the M1 kart structure (body + nose + 4 wheels)', () => {
    const mesh = buildKartMesh(CHARACTERS[0]);
    expect(mesh.children).toHaveLength(6);
    const named = mesh.children.filter((m) => m.name === 'body' || m.name === 'nose');
    expect(named).toHaveLength(2);
  });

  it('scales the body by the silhouette over a shared geometry', () => {
    const stock = buildKartMesh(CHARACTERS[0]).getObjectByName('body') as THREE.Mesh;
    const wide = buildKartMesh(CHARACTERS[1]).getObjectByName('body') as THREE.Mesh;
    expect(wide.scale.x / stock.scale.x).toBeCloseTo(1.15, 3);
    expect(wide.geometry).toBe(stock.geometry); // one unit box for everyone
  });

  it('caches one group per character id', () => {
    expect(buildKartMesh(CHARACTERS[0])).toBe(buildKartMesh(CHARACTERS[0]));
    expect(buildKartMesh(CHARACTERS[0])).not.toBe(buildKartMesh(CHARACTERS[1]));
  });
});
