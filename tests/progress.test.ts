import { describe, expect, it } from 'vitest';
import { mergeRecord } from '../src/game/progress';

describe('진행 기록 병합', () => {
  it('첫 기록은 그대로 반영된다', () => {
    expect(mergeRecord(undefined, true, 890)).toEqual({ cleared: true, bestScore: 890 });
    expect(mergeRecord(undefined, false, 120)).toEqual({ cleared: false, bestScore: 120 });
  });

  it('한 번 클리어했으면 이후 실패해도 클리어 상태가 유지된다', () => {
    const prev = { cleared: true, bestScore: 500 };
    expect(mergeRecord(prev, false, 100)).toEqual({ cleared: true, bestScore: 500 });
  });

  it('점수는 최고 기록만 남는다', () => {
    const prev = { cleared: true, bestScore: 500 };
    expect(mergeRecord(prev, true, 900).bestScore).toBe(900);
    expect(mergeRecord(prev, true, 300).bestScore).toBe(500);
  });
});
