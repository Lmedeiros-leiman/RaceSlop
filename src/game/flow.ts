export interface FlowState {
  screen: 'character' | 'track' | 'race';
  character: number;
  track: number;
}

export interface FlowCounts {
  characters: number;
  tracks: number;
}

export type FlowAction = 'left' | 'right' | 'confirm' | 'back';

export function initialFlow(): FlowState {
  return { screen: 'character', character: 0, track: 0 };
}

// Cursors are session-persistent (SPEC-M2 §7): forward and back navigation
// keep the last index per screen; only boot resets them.
export function flowKey(state: FlowState, action: FlowAction, counts: FlowCounts): FlowState {
  const wrap = (i: number, n: number): number => ((i % n) + n) % n;
  switch (state.screen) {
    case 'character':
      if (action === 'left') return { ...state, character: wrap(state.character - 1, counts.characters) };
      if (action === 'right') return { ...state, character: wrap(state.character + 1, counts.characters) };
      if (action === 'confirm') return { ...state, screen: 'track' };
      return state;
    case 'track':
      if (action === 'left') return { ...state, track: wrap(state.track - 1, counts.tracks) };
      if (action === 'right') return { ...state, track: wrap(state.track + 1, counts.tracks) };
      if (action === 'confirm') return { ...state, screen: 'race' };
      if (action === 'back') return { ...state, screen: 'character' };
      return state;
    case 'race':
      if (action === 'back') return { ...state, screen: 'track' };
      return state;
  }
}
