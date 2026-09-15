import { describe, expect, it } from 'vitest';
import { createBrowserRecordStore, createRecordStore, STORAGE_KEY } from './records';

describe('RecordStore', () => {
  it('returns null when nothing is stored', () => {
    const store = createRecordStore(() => null, () => {});
    expect(store.getBest('oval')).toBeNull();
  });

  it('records a first lap and persists it', () => {
    let saved = '';
    const store = createRecordStore(() => null, (v) => (saved = v));
    expect(store.recordLap('oval', 41.5)).toBe(true);
    expect(store.getBest('oval')).toBe(41.5);
    expect(JSON.parse(saved)).toEqual({ version: 1, best: { oval: 41.5 } });
  });

  it('keeps the better lap across reloads', () => {
    const saved = JSON.stringify({ version: 1, best: { oval: 30 } });
    const store = createRecordStore(() => saved, () => {});
    expect(store.recordLap('oval', 31)).toBe(false);
    expect(store.recordLap('oval', 29.5)).toBe(true);
    expect(store.getBest('oval')).toBe(29.5);
  });

  it('compares on rounded centiseconds (no write churn on invisible diffs)', () => {
    const saved = JSON.stringify({ version: 1, best: { oval: 30 } });
    let writes = 0;
    const store = createRecordStore(() => saved, () => (writes += 1));
    expect(store.recordLap('oval', 30.001)).toBe(false); // rounds to 30.00
    expect(store.recordLap('oval', 29.999)).toBe(false); // rounds to 30.00
    expect(writes).toBe(0);
    expect(store.getBest('oval')).toBe(30);
  });

  it('never overwrites with an equal lap', () => {
    const store = createRecordStore(() => JSON.stringify({ version: 1, best: { oval: 30 } }), () => {});
    expect(store.recordLap('oval', 30)).toBe(false);
    expect(store.getBest('oval')).toBe(30);
  });

  it('rounds to centiseconds before storing', () => {
    let saved = '';
    const store = createRecordStore(() => null, (v) => (saved = v));
    store.recordLap('oval', 12.345);
    expect(JSON.parse(saved).best.oval).toBe(12.35);
  });

  it('treats corrupt JSON as empty', () => {
    const store = createRecordStore(() => '{not json', () => {});
    expect(store.getBest('oval')).toBeNull();
    expect(store.recordLap('oval', 10)).toBe(true);
  });

  it('ignores a wrong-version payload', () => {
    const store = createRecordStore(() => JSON.stringify({ version: 2, best: { oval: 1 } }), () => {});
    expect(store.getBest('oval')).toBeNull();
  });

  it('survives a throwing load (private-mode read)', () => {
    const store = createRecordStore(() => { throw new Error('blocked'); }, () => {});
    expect(store.getBest('oval')).toBeNull();
    expect(store.recordLap('oval', 10)).toBe(true);
    expect(store.getBest('oval')).toBe(10);
  });

  it('survives a throwing save (quota exceeded)', () => {
    const store = createRecordStore(() => null, () => { throw new Error('quota'); });
    expect(() => store.recordLap('oval', 10)).not.toThrow();
    expect(store.getBest('oval')).toBe(10);
  });

  it('tracks bests per track id independently', () => {
    const saved = JSON.stringify({ version: 1, best: { oval: 30 } });
    const store = createRecordStore(() => saved, () => {});
    expect(store.getBest('circuit')).toBeNull();
    expect(store.recordLap('circuit', 40)).toBe(true);
    expect(store.getBest('oval')).toBe(30);
  });
});

describe('browser adapter', () => {
  it('uses the spec storage key', () => {
    expect(STORAGE_KEY).toBe('raceslop.records.v1');
  });

  it('round-trips through a storage-like fake', () => {
    const mem = new Map<string, string>();
    const store = createRecordStore(() => mem.get(STORAGE_KEY) ?? null, (v) => mem.set(STORAGE_KEY, v));
    expect(store.recordLap('oval', 20)).toBe(true);
    const reloaded = createRecordStore(() => mem.get(STORAGE_KEY) ?? null, (v) => mem.set(STORAGE_KEY, v));
    expect(reloaded.getBest('oval')).toBe(20);
  });

  it('exposes createBrowserRecordStore for the browser only', () => {
    expect(typeof createBrowserRecordStore).toBe('function');
  });
});
