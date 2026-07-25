import { describe, expect, it } from 'vitest';
import { ComboMatchEngine } from '../src/core/engine';
import { loadLevel } from '../src/core/level-loader';
import type { LevelData } from '../src/core/types';
import { makeLevel } from './fixtures/levels';

const engineOf = (l: LevelData) => new ComboMatchEngine(loadLevel(l), {});

describe('규칙 장치 (F계층)', () => {
  it('🔒 콤보 잠금: 콤보 미달 → combo-locked, 도달 후 해제. 와일드는 우회(레퍼런스 준거, ADR-001 O-5①)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [
        { symbols: ['A', 'B'] },
        { symbols: ['B', 'D'] },
        { symbols: ['B', 'C'], lockReq: 2 },
      ],
      config: { deck: 0, wild: 1, cgoal: 9 },
    });
    const e = engineOf(l);
    expect(e.tryMatch(2)).toEqual({ ok: false, reason: 'combo-locked' });
    e.tryMatch(0);
    expect(e.tryMatch(2)).toEqual({ ok: false, reason: 'combo-locked' }); // combo 1 < 2
    e.tryMatch(1);
    expect(e.tryMatch(2).ok).toBe(true); // combo 2

    const e2 = engineOf(l);
    expect(e2.useWild(2).ok).toBe(true); // 와일드는 lockReq 우회
  });

  it('🔑 열쇠-자물쇠: 열쇠 제거 전 key-locked', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'], unlockedBy: [0] }],
      config: { deck: 0, wild: 0, cgoal: 9 },
    });
    const e = engineOf(l);
    expect(e.tryMatch(1)).toEqual({ ok: false, reason: 'key-locked' });
    e.tryMatch(0);
    expect(e.tryMatch(1).ok).toBe(true);
  });

  it('🗺️ 구역: 낮은 구역 소진 전 zone-locked, 소진 후 개방', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'], zone: 1 }],
      config: { deck: 0, wild: 0, cgoal: 9, zones: 2 },
    });
    const e = engineOf(l);
    expect(e.tryMatch(1)).toEqual({ ok: false, reason: 'zone-locked' });
    e.tryMatch(0); // zone0 소진
    expect(e.tryMatch(1).ok).toBe(true);
  });

  it('🧻 종이+🧩 조각: 조각 수집 전 paper-locked, 수집 완료 시 paperFreed 후 해제', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'], piece: true }, { symbols: ['A', 'B'], paper: true }],
      config: { deck: 0, wild: 0, cgoal: 9 },
      rules: { paper: { piecesNeeded: 1, count: 1 } },
    });
    const e = engineOf(l);
    const freed: number[] = [];
    e.events.on('paperFreed', (p) => freed.push(p.pieces));
    expect(e.tryMatch(1)).toEqual({ ok: false, reason: 'paper-locked' });
    e.tryMatch(0);
    expect(freed).toEqual([1]);
    expect(e.tryMatch(1).ok).toBe(true);
  });

  it('💣 폭탄: 매 행동(매치·드로우·와일드) −1, 0 도달 즉시 bomb-exploded 패배', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [
        { symbols: ['A', 'B'] },
        { symbols: ['B', 'C'] },
        { symbols: ['C', 'D'], bombCounter: 3 },
      ],
      stock: [['A', 'C']],
      config: { deck: 1, wild: 1, cgoal: 9 },
    });
    const e = engineOf(l);
    const ticks: number[] = [];
    e.events.on('bombTicked', (p) => ticks.push(p.counter));
    e.tryMatch(0); // tick → 2
    e.draw(); // tick → 1
    e.tryMatch(1); // tick → 0 → 폭발
    expect(ticks).toEqual([2, 1, 0]);
    expect(e.getState().status).toBe('lost');
    expect(e.endReason).toBe('bomb-exploded');
  });

  it('💣 제거된 폭탄은 틱되지 않는다 (제거 = 해체)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'], bombCounter: 2 }, { symbols: ['A', 'C'] }, { symbols: ['A', 'B'] }],
      config: { deck: 0, wild: 0, cgoal: 9 },
    });
    const e = engineOf(l);
    e.tryMatch(0); // 폭탄 해체 (자기 제거 — 틱 없음)
    e.tryMatch(1);
    e.tryMatch(2);
    expect(e.getState().status).toBe('won');
  });

  it('🎯 수집: 목표 도달 즉시 조기 승리 — 같은 행동의 폭탄 틱보다 선행', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'], bombCounter: 1 }, { symbols: ['B', 'C'] }],
      config: { deck: 0, wild: 0, objective: 'collect', cgoal: 9 },
      rules: { collectGoal: { symbol: 'B', count: 1 } },
    });
    const e = engineOf(l);
    e.tryMatch(1); // B 수집 1/1 — 폭탄(0) 틱 전에 승리... 단 폭탄은 카드0 소유, 틱되면 즉사였음
    expect(e.getState().status).toBe('won');
    expect(e.endReason).toBe('collect-goal');
  });

  it('🎯 수집 미달 + 보드 소진 → collect-unmet 패배', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }],
      config: { deck: 0, wild: 0, objective: 'collect', cgoal: 9 },
      rules: { collectGoal: { symbol: 'A', count: 2 } },
    });
    const e = engineOf(l);
    e.tryMatch(0); // A 수집 1
    e.tryMatch(1); // A 없음 — 보드 소진, 1 < 2
    expect(e.getState().status).toBe('lost');
    expect(e.endReason).toBe('collect-unmet');
  });

  it('이동 제한: moves 도달 시 보드 미완이면 move-limit 패배 (매치 경로만 검사 — 레퍼런스 준거)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }, { symbols: ['C', 'D'] }],
      config: { deck: 0, wild: 0, moves: 2, cgoal: 9 },
    });
    const e = engineOf(l);
    e.tryMatch(0);
    e.tryMatch(1);
    expect(e.getState().status).toBe('lost');
    expect(e.endReason).toBe('move-limit');
  });

  it('🧲 집게: 덮인 카드도 제거, 콤보·액티브·점수 불변, 폭탄 틱O·수집 카운트O (ADR-001 O-5② 가정)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['C', 'A'] }, { symbols: ['A', 'B'] }, { symbols: ['B', 'C'], bombCounter: 5 }],
      coverage: [{ id: 0, coveredBy: [1] }],
      config: { deck: 0, wild: 0, objective: 'collect', cgoal: 9 },
      rules: { collectGoal: { symbol: 'C', count: 2 } },
    });
    const e = engineOf(l);
    const before = e.getState();
    expect(e.useClaw(0).ok).toBe(true); // 덮여 있어도 제거
    const after = e.getState();
    expect(after.combo).toBe(before.combo);
    expect(after.score).toBe(before.score);
    expect(after.active).toEqual(before.active);
    expect(after.collected).toBe(1); // C 수집
    expect(e.useClaw(2).ok).toBe(true); // C 수집 2/2 → 조기 승리
    expect(e.getState().status).toBe('won');
    expect(e.endReason).toBe('collect-goal');
  });
});
