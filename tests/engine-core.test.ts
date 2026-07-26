import { describe, expect, it } from 'vitest';
import { ComboMatchEngine } from '../src/core/engine';
import { loadLevel } from '../src/core/level-loader';
import type { LevelData } from '../src/core/types';
import { makeLevel } from './fixtures/levels';
import { mulberry32 as refMulberry32 } from './reference/reference-sim';

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

  it('cgoal 배수 판정은 레퍼런스 truthy 동치 — 음수 cgoal도 보너스 지급 (감사 회귀)', () => {
    // 로더가 음수 cgoal을 차단하지만, 엔진 자체도 레퍼런스(runOneSim: L.cgoal && combo%L.cgoal===0)와
    // 전 입력에서 동치여야 한다. cgoal=-1이면 combo%-1===-0 → ===0 참 → 매 매치 보너스.
    const rt = { ...loadLevel(chain3()), cgoal: -1 };
    const e = new ComboMatchEngine(rt, {});
    expect(e.tryMatch(0).ok).toBe(true);
    expect(e.getState().score).toBe(110); // 10×1 + 100×1
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

  it('프로덕션 기본 drawFallback: 레퍼런스 drawActive와 시드 동치 (차등 테스트는 항상 오버라이드 — 감사 갭)', () => {
    const pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let seed = 1; seed <= 20; seed++) {
      const l = makeLevel({
        pool,
        active: ['A', 'B'],
        cards: [{ symbols: ['C', 'D'] }], // 매치 불가 — 드로우 경로만 사용
        config: { deck: 3, cgoal: 9 },
        seed,
      });
      const e = new ComboMatchEngine(loadLevel(l), {}); // drawFallback 미주입 = 프로덕션 기본 경로
      const rng = refMulberry32(seed >>> 0); // 레퍼런스 drawActive 재현 (Fisher-Yates → k개)
      for (let d = 0; d < 3; d++) {
        const arr = pool.slice();
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const t = arr[i]!;
          arr[i] = arr[j]!;
          arr[j] = t;
        }
        const r = e.draw();
        expect(r.ok && r.active, `seed ${seed}, draw ${d}`).toEqual(arr.slice(0, 2));
      }
    }
  });

  it('r=2 경계: 공유 r-1개 → no-shared-symbol, 공유 r개 → 승인', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D', 'E'],
      active: ['A', 'B', 'C'],
      cards: [{ symbols: ['A', 'D', 'E'] }, { symbols: ['A', 'B', 'D'] }],
      config: { k: 3, r: 2, deck: 0, cgoal: 9 },
    });
    const e = engineOf(l);
    expect(e.tryMatch(0)).toEqual({ ok: false, reason: 'no-shared-symbol' }); // 공유 1 < r 2
    expect(e.tryMatch(1).ok).toBe(true); // 공유 2 (A,B)
  });

  it('거부 우선순위: covered > zone-locked > key-locked > paper-locked > combo-locked > no-shared-symbol', () => {
    // 인접 우선순위 쌍마다 두 위반을 동시에 걸고 상위 사유가 보고되는지 고정 (rejectReasonFor 판정 순서 계약)
    const covered_zone = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'], zone: 1 }, { symbols: ['A', 'C'] }],
      coverage: [{ id: 0, coveredBy: [1] }],
      config: { deck: 0, cgoal: 9, zones: 2 },
    });
    expect(engineOf(covered_zone).tryMatch(0)).toEqual({ ok: false, reason: 'covered' });

    const zone_key = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'], zone: 1, unlockedBy: [0] }],
      config: { deck: 0, cgoal: 9, zones: 2 },
    });
    expect(engineOf(zone_key).tryMatch(1)).toEqual({ ok: false, reason: 'zone-locked' });

    const key_paper = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'], piece: true }, { symbols: ['A', 'B'], unlockedBy: [0], paper: true }],
      config: { deck: 0, cgoal: 9 },
      rules: { paper: { piecesNeeded: 1, count: 1 } },
    });
    expect(engineOf(key_paper).tryMatch(1)).toEqual({ ok: false, reason: 'key-locked' });

    const paper_combo = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'], piece: true }, { symbols: ['A', 'B'], paper: true, lockReq: 2 }],
      config: { deck: 0, cgoal: 9 },
      rules: { paper: { piecesNeeded: 1, count: 1 } },
    });
    expect(engineOf(paper_combo).tryMatch(1)).toEqual({ ok: false, reason: 'paper-locked' });

    const combo_noshare = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['C', 'D'], lockReq: 2 }],
      config: { deck: 0, cgoal: 9 },
    });
    expect(engineOf(combo_noshare).tryMatch(1)).toEqual({ ok: false, reason: 'combo-locked' });
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

  it('isStuck: wildLeft 판정이 useWild 가드(<=0)와 일치 — 음수 와일드에서도 막힘 보고 (감사 회귀)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['C', 'D'] }],
      config: { deck: 0, wild: 0 },
    });
    const e = engineOf(l);
    e.addWild(-1); // 세션 계층 오사용 상정 — useWild는 no-wild로 거부하므로 막힘이어야 한다
    expect(e.useWild(0)).toEqual({ ok: false, reason: 'no-wild' });
    expect(e.isStuck()).toBe(true);
  });

  it('isRevealed: faceDown 카드는 free 전까지 심볼 미공개, 개방 시 공개 (감사 갭)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'], faceDown: true }, { symbols: ['A', 'B'] }],
      coverage: [{ id: 0, coveredBy: [1] }],
      config: { deck: 0 },
    });
    const e = engineOf(l);
    expect(e.isRevealed(0)).toBe(false); // faceDown + 덮임
    expect(e.isRevealed(1)).toBe(true); // faceDown 아님 — 항상 공개
    e.tryMatch(1); // 덮개 제거 → 0이 free
    expect(e.isRevealed(0)).toBe(true);
  });

  it('addWild: 세션 보충 후 no-wild가 해제된다 (감사 갭)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['C', 'D'] }],
      config: { deck: 0, wild: 0 },
    });
    const e = engineOf(l);
    expect(e.useWild(0)).toEqual({ ok: false, reason: 'no-wild' });
    e.addWild(1);
    expect(e.useWild(0).ok).toBe(true);
    expect(e.getState().wild).toBe(0);
  });

  it('getMatchableIds/getWildableIds: 게이트·공유·제거를 반영한 후보 목록 (감사 갭)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [
        { symbols: ['A', 'C'] }, // 0: 매치 가능
        { symbols: ['C', 'D'] }, // 1: 공유 없음 — 와일드만 가능
        { symbols: ['A', 'B'], zone: 1 }, // 2: 구역 잠금 — 와일드도 불가
      ],
      config: { deck: 0, wild: 1, cgoal: 9, zones: 2 },
    });
    const e = engineOf(l);
    expect(e.getMatchableIds()).toEqual([0]);
    expect(e.getWildableIds()).toEqual([0, 1]); // zone 잠금(2)은 와일드 목록에서도 제외
    e.tryMatch(0); // 제거 반영 + active [A,C]
    expect(e.getMatchableIds()).toEqual([1]); // C 공유, zone0에 1 잔존이라 2는 여전히 잠금
    expect(e.getWildableIds()).toEqual([1]);
  });

  it('scoreGoal: 와일드 경로에서도 발동하며, 같은 행동에서는 수집 목표가 선행한다 (C2 확장 경계, 감사 갭)', () => {
    const lw = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['C', 'D'] }, { symbols: ['A', 'B'] }],
      config: { deck: 0, wild: 1, cgoal: 9 },
      rules: { scoreGoal: { score: 10 } },
    });
    const ew = engineOf(lw);
    expect(ew.useWild(0).ok).toBe(true); // 10점 도달
    expect(ew.endReason).toBe('score-goal');

    const lb = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }],
      config: { deck: 0, wild: 0, objective: 'collect', cgoal: 9 },
      rules: { collectGoal: { symbol: 'A', count: 1 }, scoreGoal: { score: 10 } },
    });
    const eb = engineOf(lb);
    expect(eb.tryMatch(0).ok).toBe(true); // 수집 1/1과 점수 10 동시 도달
    expect(eb.endReason).toBe('collect-goal'); // 판정 순서 계약: 수집 → scoreGoal
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
