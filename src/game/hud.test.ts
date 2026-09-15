import { describe, expect, it } from 'vitest';
import { formatTime } from './hud';

describe('formatTime', () => {
  it('formats centiseconds with minutes', () => {
    expect(formatTime(65.2)).toBe('1:05.20');
    expect(formatTime(9.876)).toBe('0:09.88');
    expect(formatTime(0)).toBe('0:00.00');
  });

  it('rolls over minutes at the centisecond boundary', () => {
    expect(formatTime(59.999)).toBe('1:00.00');
    expect(formatTime(119.999)).toBe('2:00.00');
  });
});
