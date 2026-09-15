import { describe, expect, it } from 'vitest';
import { consumeActions, setKey } from './input';
import { createRawInput } from './types';

describe('setKey', () => {
  it('maps arrows and WASD', () => {
    const s = createRawInput();
    setKey(s, 'ArrowUp', true);
    setKey(s, 'KeyA', true);
    expect(s.throttle).toBe(true);
    expect(s.left).toBe(true);
    setKey(s, 'ArrowUp', false);
    expect(s.throttle).toBe(false);
  });

  it('maps drift to Space and Shift', () => {
    const s = createRawInput();
    setKey(s, 'Space', true);
    expect(s.drift).toBe(true);
    setKey(s, 'Space', false);
    setKey(s, 'ShiftLeft', true);
    expect(s.drift).toBe(true);
  });

  it('ignores unknown keys', () => {
    const s = createRawInput();
    setKey(s, 'KeyQ', true);
    expect(s).toEqual(createRawInput());
  });
});

describe('consumeActions', () => {
  it('returns and clears edge flags', () => {
    const s = createRawInput();
    setKey(s, 'KeyR', true);
    expect(consumeActions(s)).toEqual({ reset: true, confirm: false, escape: false });
    expect(consumeActions(s)).toEqual({ reset: false, confirm: false, escape: false });
  });

  it('captures Enter as confirm and Escape as escape', () => {
    const s = createRawInput();
    setKey(s, 'Enter', true);
    setKey(s, 'Escape', true);
    expect(consumeActions(s)).toEqual({ reset: false, confirm: true, escape: true });
  });

  it('ignores key repeat for edge actions (no cursor spin, no double-fire)', () => {
    const s = createRawInput();
    setKey(s, 'Enter', true, true);
    setKey(s, 'Escape', true, true);
    setKey(s, 'KeyR', true, true);
    expect(consumeActions(s)).toEqual({ reset: false, confirm: false, escape: false });
  });
});
