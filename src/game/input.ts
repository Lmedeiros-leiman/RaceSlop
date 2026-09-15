import type { RawInput } from './types';

const GAME_CODES = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'Enter', 'ShiftLeft', 'ShiftRight',
]);

export function setKey(s: RawInput, code: string, down: boolean): void {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      s.throttle = down;
      break;
    case 'ArrowDown':
    case 'KeyS':
      s.brake = down;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      s.left = down;
      break;
    case 'ArrowRight':
    case 'KeyD':
      s.right = down;
      break;
    case 'Space':
    case 'ShiftLeft':
    case 'ShiftRight':
      s.drift = down;
      break;
    case 'KeyR':
      if (down) s.reset = true;
      break;
    case 'Enter':
      if (down) s.restart = true;
      break;
    default:
      break;
  }
}

export function consumeActions(s: RawInput): { reset: boolean; restart: boolean } {
  const out = { reset: s.reset, restart: s.restart };
  s.reset = false;
  s.restart = false;
  return out;
}

export function attachKeyboard(s: RawInput): () => void {
  const down = (e: KeyboardEvent): void => {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    setKey(s, e.code, true);
  };
  const up = (e: KeyboardEvent): void => {
    setKey(s, e.code, false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
