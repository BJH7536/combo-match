import { describe, expect, it } from 'vitest';
import { LevelLoadError, loadLevel } from '../src/core/level-loader';
import { makeLevel } from './fixtures/levels';

const valid = () =>
  makeLevel({
    pool: ['A', 'B', 'C'],
    active: ['A', 'B'],
    cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }],
    stock: [['A', 'C']],
    config: { deck: 2 },
  });

describe('level@2 loader', () => {
  it('유효 레벨을 정규화 로드한다', () => {
    const rt = loadLevel(valid());
    expect(rt.cards).toHaveLength(2);
    expect(rt.coveredBy).toEqual([[], []]);
    expect(rt.deck).toBe(2);
    expect(rt.r).toBe(1);
  });

  it('id ≠ index → LevelLoadError', () => {
    const l = valid();
    l.cards[1]!.id = 5;
    expect(() => loadLevel(l)).toThrow(LevelLoadError);
  });

  it('r > k → LevelLoadError', () => {
    const l = valid();
    l.config.r = 3;
    expect(() => loadLevel(l)).toThrow(LevelLoadError);
  });

  it('pool에 없는 심볼 → LevelLoadError', () => {
    const l = valid();
    l.cards[0]!.symbols = ['A', 'Z'];
    expect(() => loadLevel(l)).toThrow(LevelLoadError);
  });

  it('coverage 순환 → LevelLoadError', () => {
    const l = makeLevel({
      pool: ['A', 'B'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'] }, { symbols: ['A', 'B'] }],
      coverage: [
        { id: 0, coveredBy: [1] },
        { id: 1, coveredBy: [0] },
      ],
    });
    expect(() => loadLevel(l)).toThrow(/순환/);
  });

  it('coverage 항목 누락 → LevelLoadError', () => {
    const l = valid();
    l.coverage = [l.coverage[0]!];
    expect(() => loadLevel(l)).toThrow(/누락/);
  });

  it('자기 자신을 열쇠로 참조 → LevelLoadError', () => {
    const l = valid();
    l.cards[0]!.unlockedBy = [0];
    expect(() => loadLevel(l)).toThrow(LevelLoadError);
  });

  it('종이 카드 존재 + rules.paper 부재 → LevelLoadError', () => {
    const l = valid();
    l.cards[0]!.paper = true;
    expect(() => loadLevel(l)).toThrow(/rules\.paper/);
  });

  it('piecesNeeded > 조각 카드 수 → LevelLoadError', () => {
    const l = valid();
    l.cards[0]!.paper = true;
    l.rules = { paper: { piecesNeeded: 2, count: 1 } };
    expect(() => loadLevel(l)).toThrow(/piecesNeeded/);
  });

  it('카드 내 중복 심볼 → LevelLoadError', () => {
    const l = valid();
    l.cards[0]!.symbols = ['A', 'A'];
    expect(() => loadLevel(l)).toThrow(/중복 심볼/);
  });

  it('cgoal 음수/비정수 → LevelLoadError (엔진 배수 판정으로의 발산 입력 차단 — 감사 회귀)', () => {
    const neg = valid();
    neg.config.cgoal = -1;
    expect(() => loadLevel(neg)).toThrow(/cgoal/);
    const frac = valid();
    frac.config.cgoal = 2.5;
    expect(() => loadLevel(frac)).toThrow(/cgoal/);
  });
});
