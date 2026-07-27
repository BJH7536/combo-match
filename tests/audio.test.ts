import { describe, expect, it } from 'vitest';
import { comboPitch } from '../src/game/audio';

describe('콤보 음정', () => {
  it('콤보가 오를수록 음이 높아진다', () => {
    const pitches = [1, 2, 3, 4, 5].map(comboPitch);
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]!).toBeGreaterThan(pitches[i - 1]!);
    }
  });

  it('충분히 이어가면 한 옥타브 이상 올라간다 (연쇄가 귀에 들려야 한다)', () => {
    expect(comboPitch(10)).toBeGreaterThanOrEqual(comboPitch(1) * 2);
  });

  it('콤보가 아무리 길어도 음이 무한정 높아지지 않는다', () => {
    expect(comboPitch(999)).toBe(comboPitch(50));
    expect(comboPitch(999)).toBeLessThan(comboPitch(1) * 8);
  });

  it('콤보 0·음수도 기준음으로 떨어진다 (와일드 경로에서 0이 올 수 있다)', () => {
    expect(comboPitch(0)).toBe(comboPitch(1));
    expect(comboPitch(-3)).toBe(comboPitch(1));
  });
});
