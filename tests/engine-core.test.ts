import { describe, expect, it } from 'vitest';
import { ComboMatchEngine } from '../src/core/engine';
import { loadLevel } from '../src/core/level-loader';
import type { LevelData } from '../src/core/types';
import { makeLevel } from './fixtures/levels';

const engineOf = (l: LevelData, drawFallback?: (pool: readonly string[], k: number) => string[]) =>
  new ComboMatchEngine(loadLevel(l), drawFallback ? { drawFallback } : {});

const chain3 = (over: Record<string, unknown> = {}) =>
  makeLevel({
    pool: ['A', 'B', 'C', 'D'],
    active: ['A', 'D'],
    cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }, { symbols: ['C', 'D'] }],
    stock: [['D', 'A'], ['B', 'D']],
    config: { deck: 3, wild: 1, cgoal: 2, ...over },
  });

describe('매칭·체이닝·점수', () => {
  it('매치 성공: 10×콤보 점수, 선택 카드가 새 액티브, cgoal 배수 보너스 +100×콤보', () => {
    const e = engineOf(chain3());
    expect(e.tryMatch(0).ok).toBe(true); // A 공유
    let s = e.getState();
    expect([s.combo, s.score, s.active]).toEqual([1, 10, ['A', 'B']]);
    expect(e.tryMatch(1).ok).toBe(true); // B 공유 — combo 2 = cgoal → 20 + 200
    s = e.getState();
    expect([s.combo, s.score]).toEqual([2, 230]);
  });

  it('거부: 미존재/제거됨 → not-found, 공유 없음 → no-shared-symbol (상태 무변화)', () => {
    const e = engineOf(chain3());
    expect(e.tryMatch(99)).toEqual({ ok: false, reason: 'not-found' });
    expect(e.tryMatch(1)).toEqual({ ok: false, reason: 'no-shared-symbol' }); // active [A,D] vs [B,C]
    expect(e.tryMatch(0).ok).toBe(true);
    expect(e.tryMatch(0)).toEqual({ ok: false, reason: 'not-found' }); // 이미 제거
    expect(e.getState().score).toBe(10);
  });

  it('covered 카드 → covered 거부, 덮개 제거 후 선택 가능 + cardUncovered 발행', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }],
      coverage: [{ id: 0, coveredBy: [1, 2] }],
      config: { deck: 0 },
    });
    const e = engineOf(l);
    const uncovered: number[] = [];
    e.events.on('cardUncovered', (p) => uncovered.push(p.id));
    expect(e.tryMatch(0)).toEqual({ ok: false, reason: 'covered' });
    expect(e.tryMatch(1).ok).toBe(true);
    expect(uncovered).toEqual([]);
    expect(e.tryMatch(2).ok).toBe(true); // 마지막 덮개 제거 → 0 개방
    expect(uncovered).toEqual([0]);
    expect(e.tryMatch(0).ok).toBe(true);
    expect(e.getState().status).toBe('won');
    expect(e.endReason).toBe('board-cleared');
  });

  it('드로우: 스톡을 끝(pop)부터 소진 → 고갈 시 fallback, 콤보 리셋', () => {
    const seen: string[][] = [];
    const e = engineOf(chain3(), () => ['A', 'B']);
    expect(e.tryMatch(0).ok).toBe(true);
    expect(e.getState().combo).toBe(1);
    let r = e.draw();
    expect(r.ok && r.active).toEqual(['B', 'D']); // 스톡 마지막 항목 먼저 (레퍼런스 pop 준거)
    expect(e.getState().combo).toBe(0);
    r = e.draw();
    expect(r.ok && r.active).toEqual(['D', 'A']);
    r = e.draw(); // 스톡 고갈 → fallback
    expect(r.ok && r.active).toEqual(['A', 'B']);
    expect(e.draw()).toEqual({ ok: false, reason: 'deck-empty' }); // deck 3 소진
    void seen;
  });

  it('와일드: 공유 무관 제거, 콤보 유지(최소 1), cgoal 보너스 없음', () => {
    const e = engineOf(chain3({ cgoal: 1 })); // cgoal 1 — 매치라면 매번 보너스가 붙는 설정
    expect(e.useWild(1).ok).toBe(true); // [B,C] — active와 공유 없음
    const s = e.getState();
    expect([s.combo, s.score, s.wild]).toEqual([1, 10, 0]); // 보너스 없이 10×1
    expect(e.useWild(2)).toEqual({ ok: false, reason: 'no-wild' });
  });

  it('scoreGoal(C2 확장): 도달 즉시 score-goal 승리', () => {
    const l = chain3();
    l.rules = { scoreGoal: { score: 15 } };
    const e = engineOf(l);
    expect(e.tryMatch(0).ok).toBe(true);
    expect(e.getState().status).toBe('playing'); // 10 < 15
    expect(e.tryMatch(1).ok).toBe(true); // 230 ≥ 15
    expect(e.getState().status).toBe('won');
    expect(e.endReason).toBe('score-goal');
  });

  it('isStuck: 유효 매치 없음 ∧ 덱 0 ∧ 와일드 불가일 때만 참', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['C', 'D'] }],
      config: { deck: 0, wild: 0 },
    });
    expect(engineOf(l).isStuck()).toBe(true);
    const l2 = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['C', 'D'] }],
      config: { deck: 0, wild: 1 },
    });
    expect(engineOf(l2).isStuck()).toBe(false); // 와일드로 탈출 가능
  });

  it('게임 종료 후 행동 → game-over', () => {
    const l = makeLevel({
      pool: ['A', 'B'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'] }],
      config: { deck: 1, wild: 1 },
      stock: [['A', 'B']],
    });
    const e = engineOf(l);
    expect(e.tryMatch(0).ok).toBe(true);
    expect(e.getState().status).toBe('won');
    expect(e.tryMatch(0)).toEqual({ ok: false, reason: 'game-over' });
    expect(e.draw()).toEqual({ ok: false, reason: 'game-over' });
    expect(e.useWild(0)).toEqual({ ok: false, reason: 'game-over' });
  });

  it('이벤트 순서: cardRemoved → cardUncovered → activeChanged → comboChanged 아님 — 콤보가 액티브보다 뒤', () => {
    // 계약: removeCardState(cardRemoved→cardUncovered→piece) → activeChanged → comboChanged → scoreChanged
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'] }],
      coverage: [{ id: 0, coveredBy: [1] }],
      config: { deck: 0 },
    });
    const e = engineOf(l);
    const order: string[] = [];
    e.events.on('cardRemoved', () => order.push('removed'));
    e.events.on('cardUncovered', () => order.push('uncovered'));
    e.events.on('activeChanged', () => order.push('active'));
    e.events.on('comboChanged', () => order.push('combo'));
    e.events.on('scoreChanged', () => order.push('score'));
    e.tryMatch(1);
    expect(order).toEqual(['removed', 'uncovered', 'active', 'combo', 'score']);
  });
});
