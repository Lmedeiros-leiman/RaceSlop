export function formatTime(sec: number): string {
  const cs = Math.round(Math.max(0, sec) * 100);
  const m = Math.floor(cs / 6000);
  const s = (cs % 6000) / 100;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export interface HudData {
  current: number;
  last: number | null;
  best: number | null;
  drifting: boolean;
  boost: boolean;
}

function cell(root: HTMLElement, name: string, label: string): HTMLElement {
  const existing = root.querySelector<HTMLElement>(`[data-hud="${name}"]`);
  if (existing) return existing;
  const wrap = document.createElement('div');
  const lab = document.createElement('span');
  lab.textContent = `${label} `;
  const val = document.createElement('span');
  val.setAttribute('data-hud', name);
  wrap.append(lab, val);
  root.appendChild(wrap);
  return val;
}

const DASH = '--:--.--';

export function updateHud(root: HTMLElement, d: HudData): void {
  cell(root, 'current', 'TIME').textContent = formatTime(d.current);
  cell(root, 'last', 'LAST').textContent = d.last === null ? DASH : formatTime(d.last);
  cell(root, 'best', 'BEST').textContent = d.best === null ? DASH : formatTime(d.best);
  const state = d.boost ? 'BOOST' : d.drifting ? 'DRIFT' : '';
  cell(root, 'state', '').textContent = state;
}
