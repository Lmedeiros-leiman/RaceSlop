import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';

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
