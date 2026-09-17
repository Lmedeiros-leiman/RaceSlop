import { describe, expect, it } from 'vitest';
import { flowKey, initialFlow } from './flow';

const counts = { characters: 4, tracks: 4 };

describe('flowKey', () => {
  it('boots on the character screen with cursors at 0', () => {
    expect(initialFlow()).toEqual({ screen: 'character', character: 0, track: 0 });
  });

  it('moves and wraps the active cursor', () => {
    let s = initialFlow();
    s = flowKey(s, 'left', counts);
    expect(s.character).toBe(3);
    s = flowKey(s, 'confirm', counts);
    s = flowKey(s, 'right', counts);
    expect(s).toEqual({ screen: 'track', character: 3, track: 1 });
    s = flowKey(s, 'left', counts);
    expect(s.track).toBe(0);
  });

  it('remembers both cursors across the whole session (Esc keeps your place)', () => {
    let s = initialFlow();
    s = flowKey(s, 'right', counts); // character 1
    s = flowKey(s, 'confirm', counts);
    s = flowKey(s, 'right', counts);
    s = flowKey(s, 'right', counts); // track 2
    s = flowKey(s, 'confirm', counts);
    expect(s).toEqual({ screen: 'race', character: 1, track: 2 });
    s = flowKey(s, 'back', counts); // race -> track, cursor on the raced track
    expect(s).toEqual({ screen: 'track', character: 1, track: 2 });
    s = flowKey(s, 'back', counts); // track -> character, character cursor kept
    expect(s).toEqual({ screen: 'character', character: 1, track: 2 });
    s = flowKey(s, 'confirm', counts); // forward again: track cursor still 2
    expect(s).toEqual({ screen: 'track', character: 1, track: 2 });
  });

  it('ignores back on character and stray keys in race', () => {
    expect(flowKey(initialFlow(), 'back', counts)).toEqual(initialFlow());
    const race = { screen: 'race', character: 0, track: 0 } as const;
    expect(flowKey(race, 'confirm', counts)).toBe(race);
    expect(flowKey(race, 'right', counts)).toBe(race);
  });

  it('does not mutate the input state', () => {
    const s = { screen: 'track', character: 2, track: 1 } as const;
    flowKey(s, 'left', counts);
    expect(s).toEqual({ screen: 'track', character: 2, track: 1 });
  });
});
