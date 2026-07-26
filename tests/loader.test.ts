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

  it('deck/wild/moves/k 비숫자·비정수 → LevelLoadError (NaN 무한 드로우·무한 와일드 차단 — 감사 회귀)', () => {
    for (const key of ['deck', 'wild', 'moves', 'k'] as const) {
      const missing = valid();
      delete (missing.config as unknown as Record<string, unknown>)[key];
      expect(() => loadLevel(missing), `${key} 누락`).toThrow(LevelLoadError);
      const frac = valid();
      (frac.config as unknown as Record<string, unknown>)[key] = 1.5;
      expect(() => loadLevel(frac), `${key} 비정수`).toThrow(LevelLoadError);
    }
  });

  it('zone 부재는 0으로 정규화하고 비정수는 차단한다 (레퍼런스 ||0 준거 + 감사 회귀)', () => {
    // 감사 지적의 본질은 "undefined가 그대로 배열 인덱스·비교에 새는 것". 정규화로 차단한다.
    const missing = valid();
    delete (missing.cards[0] as unknown as Record<string, unknown>)['zone'];
    expect(loadLevel(missing).cards[0]!.zone).toBe(0);
    const frac = valid();
    (frac.cards[0] as unknown as Record<string, unknown>)['zone'] = 1.5;
    expect(() => loadLevel(frac)).toThrow(/zone/);
    const neg = valid();
    (neg.cards[0] as unknown as Record<string, unknown>)['zone'] = -1;
    expect(() => loadLevel(neg)).toThrow(/zone/);
  });

  it('collectGoal.count > 목표 심볼 보유 카드 수 → LevelLoadError (구조적 필패 레벨 차단 — 감사 회귀)', () => {
    const l = valid(); // A 보유 카드는 [A,B] 1장
    l.rules = { collectGoal: { symbol: 'A', count: 2 } };
    expect(() => loadLevel(l)).toThrow(/collectGoal/);
  });

  it('scoreGoal.score 0/음수/비정수 → LevelLoadError (첫 매치 즉시 승리 차단 — 감사 회귀)', () => {
    for (const bad of [0, -5, 2.5]) {
      const l = valid();
      l.rules = { scoreGoal: { score: bad } };
      expect(() => loadLevel(l), `score=${bad}`).toThrow(/scoreGoal/);
    }
  });

  it('최상위 필드 누락 → raw TypeError가 아닌 LevelLoadError (신뢰 불가 채널 대비 — 감사 회귀)', () => {
    expect(() => loadLevel({ schema: 'combo-match/level@2' } as never)).toThrow(LevelLoadError);
    const noStock = valid();
    delete (noStock as unknown as Record<string, unknown>)['deckStock'];
    expect(() => loadLevel(noStock)).toThrow(LevelLoadError);
    const badSymbols = valid();
    delete (badSymbols.cards[0] as unknown as Record<string, unknown>)['symbols'];
    expect(() => loadLevel(badSymbols)).toThrow(LevelLoadError);
    // F계층 필드(unlockedBy 등) 부재는 level@1 호환으로 허용 — tests/level-compat.test.ts가 소유
    const noUb = valid();
    delete (noUb.cards[0] as unknown as Record<string, unknown>)['unlockedBy'];
    expect(loadLevel(noUb).cards[0]!.unlockedBy).toEqual([]);
  });

  it('cards도 방어 복사한다 — 로드 후 원본 변조가 런타임에 전파되지 않음 (감사 회귀)', () => {
    const data = valid();
    const rt = loadLevel(data);
    data.cards[0]!.symbols.push('C');
    data.cards[0]!.lockReq = 99;
    expect(rt.cards[0]!.symbols).toEqual(['A', 'B']);
    expect(rt.cards[0]!.lockReq).toBe(0);
  });
});
