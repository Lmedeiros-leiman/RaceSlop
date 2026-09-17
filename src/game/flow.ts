import type { CharacterDef } from './characters';
import { formatTime } from './hud';
import type { TrackDef } from './track';

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

export interface FlowDeps {
  characters: readonly CharacterDef[];
  tracks: readonly TrackDef[];
  getBest: (trackId: string) => number | null;
}

const DASH = '--:--.--';

export function renderOverlay(
  root: HTMLElement,
  state: FlowState,
  deps: FlowDeps,
  onPick?: (screen: 'character' | 'track', index: number) => void,
): void {
  root.textContent = '';
  if (state.screen === 'race') {
    root.style.display = 'none';
    return;
  }
  root.style.display = 'flex';

  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  const panel = document.createElement('div');
  panel.style.cssText =
    'margin:auto;text-align:center;color:#fff;font-family:monospace;background:rgba(10,10,16,0.85);padding:24px 40px;border-radius:10px;';
  const title = document.createElement('h2');
  title.style.cssText = 'margin:0 0 16px;letter-spacing:2px;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px;justify-content:center;';

  const addCard = (content: HTMLElement, i: number, color: string): void => {
    const border = i === (state.screen === 'character' ? state.character : state.track) ? '#fff' : 'transparent';
    const card = document.createElement('div');
    card.style.cssText = `padding:14px 22px;border:2px solid ${border};color:${color};font-weight:bold;pointer-events:auto;cursor:pointer;`;
    card.appendChild(content);
    if (onPick) {
      card.addEventListener('click', () => onPick(state.screen as 'character' | 'track', i));
    }
    row.appendChild(card);
  };

  if (state.screen === 'character') {
    title.textContent = 'CHOOSE DRIVER';
    deps.characters.forEach((c, i) => {
      const label = document.createElement('div');
      label.textContent = c.name;
      addCard(label, i, hex(c.body));
    });
  } else {
    title.textContent = 'CHOOSE TRACK';
    deps.tracks.forEach((t, i) => {
      const content = document.createElement('div');
      const name = document.createElement('div');
      name.textContent = t.name;
      const best = document.createElement('div');
      const b = deps.getBest(t.id);
      best.textContent = b === null ? DASH : formatTime(b);
      best.style.cssText = 'font-size:12px;opacity:0.8;font-weight:normal;';
      content.append(name, best);
      addCard(content, i, hex(t.theme.edge));
    });
  }

  const hint = document.createElement('div');
  hint.textContent =
    state.screen === 'character' ? '←/→ select · ENTER confirm' : '←/→ select · ENTER race · ESC back';
  hint.style.cssText = 'margin-top:16px;font-size:12px;opacity:0.7;';
  panel.append(title, row, hint);
  root.appendChild(panel);
}
