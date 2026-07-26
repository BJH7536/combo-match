import { describe, expect, it } from 'vitest';
import sampleLevel1 from '../design/reference/sample-level-1234.json';
import { ComboMatchEngine } from '../src/core/engine';
import { loadLevel } from '../src/core/level-loader';
import type { LevelData } from '../src/core/types';

// 기획자 실물 자산 호환성 — design/reference/sample-level-1234.json은 디자이너 툴이 내보낸
// level@1 산출물로, F계층 필드(unlockedBy/bombCounter/zone/paper/piece)와 rules가 아예 없다.
// 레퍼런스 구현(liteFromLevelJson)은 이를 `||0` / `||[]` / `!!`로 정규화해 그대로 플레이하므로,
// 우리 로더도 "필드 부재 → 기본값, 필드 존재 → 엄격 검증"이어야 동작 동치가 유지된다.

const sample = sampleLevel1 as unknown as LevelData;

describe('level@1 하위 호환 (기획자 실물 자산)', () => {
  it('F계층 필드가 없는 level@1을 기본값으로 정규화해 로드한다', () => {
    const rt = loadLevel(sample);
    expect(rt.cards).toHaveLength(18);
    for (const c of rt.cards) {
      expect(c.zone).toBe(0);
      expect(c.bombCounter).toBe(0);
      expect(c.unlockedBy).toEqual([]);
      expect(c.paper).toBe(false);
      expect(c.piece).toBe(false);
    }
    expect(rt.collectGoal).toBeNull();
    expect(rt.paperNeed).toBe(0);
    expect(rt.scoreGoal).toBeNull();
  });

  it('로드한 level@1로 실제 플레이가 가능하다 (매치 성립 · 점수 가산)', () => {
    const e = new ComboMatchEngine(loadLevel(sample), {});
    const matchable = e.getMatchableIds();
    expect(matchable.length).toBeGreaterThan(0);
    expect(e.tryMatch(matchable[0]!).ok).toBe(true);
    expect(e.getState().score).toBe(10);
    expect(e.getState().combo).toBe(1);
  });

  it('부재는 허용하되 잘못된 값은 여전히 차단한다 (감사 회귀 유지)', () => {
    const bad = structuredClone(sample);
    bad.cards[0]!.zone = 1.5;
    expect(() => loadLevel(bad)).toThrow(/zone/);
    const bad2 = structuredClone(sample);
    bad2.cards[0]!.bombCounter = -3;
    expect(() => loadLevel(bad2)).toThrow(/bombCounter/);
  });
});
