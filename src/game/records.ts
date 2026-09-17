export interface RecordStore {
  getBest(trackId: string): number | null;
  recordLap(trackId: string, seconds: number): boolean;
}

interface RecordsV1 {
  version: 1;
  best: Record<string, number>;
}

function parse(raw: string | null): RecordsV1 {
  if (raw === null) return { version: 1, best: {} };
  try {
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === 'object' &&
      data !== null &&
      (data as RecordsV1).version === 1 &&
      typeof (data as RecordsV1).best === 'object' &&
      (data as RecordsV1).best !== null
    ) {
      return data as RecordsV1;
    }
  } catch {
    // corrupt payload: treat as empty
  }
  return { version: 1, best: {} };
}

export function createRecordStore(load: () => string | null, save: (v: string) => void): RecordStore {
  let data: RecordsV1;
  try {
    data = parse(load());
  } catch {
    // storage read threw (private mode): start empty
    data = { version: 1, best: {} };
  }
  return {
    getBest(trackId: string): number | null {
      const v = data.best[trackId];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },
    recordLap(trackId: string, seconds: number): boolean {
      const cs = Math.round(Math.max(0, seconds) * 100) / 100;
      const cur = data.best[trackId];
      if (typeof cur === 'number' && cs >= cur) return false;
      data.best[trackId] = cs;
      try {
        save(JSON.stringify(data));
      } catch {
        // storage write threw (quota): the session keeps the value
      }
      return true;
    },
  };
}

export const STORAGE_KEY = 'raceslop.records.v1';

export function createBrowserRecordStore(): RecordStore {
  // Memory mirror: keeps the session coherent when reads or writes throw.
  let mem: string | null = null;
  const read = (): string | null => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return mem;
    }
  };
  const write = (v: string): void => {
    mem = v;
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // quota exceeded / disabled storage: memory mirror stays authoritative
    }
  };
  return createRecordStore(read, write);
}
