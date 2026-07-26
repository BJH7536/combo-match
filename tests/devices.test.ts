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

  it('와일드도 zone/key/paper/covered 게이트는 우회 불가 (레퍼런스 gateOk 준거 — 감사 갭)', () => {
    const zoned = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'], zone: 1 }],
      config: { deck: 0, wild: 1, cgoal: 9, zones: 2 },
    });
    const ez = engineOf(zoned);
    expect(ez.useWild(1)).toEqual({ ok: false, reason: 'zone-locked' });
    expect(ez.getState().wild).toBe(1); // 거부 시 와일드 미소모

    const keyed = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'], unlockedBy: [0] }],
      config: { deck: 0, wild: 1, cgoal: 9 },
    });
    expect(engineOf(keyed).useWild(1)).toEqual({ ok: false, reason: 'key-locked' });

    const papered = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'], piece: true }, { symbols: ['A', 'B'], paper: true }],
      config: { deck: 0, wild: 1, cgoal: 9 },
      rules: { paper: { piecesNeeded: 1, count: 1 } },
    });
    expect(engineOf(papered).useWild(1)).toEqual({ ok: false, reason: 'paper-locked' });

    const stacked = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'] }],
      coverage: [{ id: 0, coveredBy: [1] }],
      config: { deck: 0, wild: 1, cgoal: 9 },
    });
    expect(engineOf(stacked).useWild(0)).toEqual({ ok: false, reason: 'covered' });
  });

  it('💣 다중 폭탄: id 오름차순으로 모두 틱, 첫 폭발 시 잔여 폭탄은 이번 행동에 틱되지 않음 (감사 갭)', () => {
    const calm = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [
        { symbols: ['A', 'B'] },
        { symbols: ['B', 'C'], bombCounter: 3 },
        { symbols: ['C', 'D'], bombCounter: 5 },
      ],
      config: { deck: 0, wild: 0, cgoal: 9 },
    });
    const e1 = engineOf(calm);
    const ticks1: [number, number][] = [];
    e1.events.on('bombTicked', (p) => ticks1.push([p.id, p.counter]));
    e1.tryMatch(0);
    expect(ticks1).toEqual([[1, 2], [2, 4]]); // 둘 다 id 순으로 틱

    const fatal = makeLevel({
      pool: ['A', 'B', 'C', 'D'],
      active: ['A', 'B'],
      cards: [
        { symbols: ['A', 'B'] },
        { symbols: ['B', 'C'], bombCounter: 1 },
        { symbols: ['C', 'D'], bombCounter: 5 },
      ],
      config: { deck: 0, wild: 0, cgoal: 9 },
    });
    const e2 = engineOf(fatal);
    const ticks2: [number, number][] = [];
    e2.events.on('bombTicked', (p) => ticks2.push([p.id, p.counter]));
    e2.tryMatch(0);
    expect(ticks2).toEqual([[1, 0]]); // 폭탄1 폭발에서 즉시 중단 — 폭탄2 미틱 (레퍼런스 준거)
    expect(e2.getState().status).toBe('lost');
    expect(e2.endReason).toBe('bomb-exploded');
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

  it('💣 폭발은 드로우·와일드·집게 행동에서도 발생한다 (감사 갭)', () => {
    const cards = [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'], bombCounter: 1 }];
    const pool = ['A', 'B', 'C'];

    const ld = makeLevel({ pool, active: ['A', 'B'], cards, stock: [['A', 'C']], config: { deck: 1, wild: 0, cgoal: 9 } });
    const ed = engineOf(ld);
    expect(ed.draw().ok).toBe(true);
    expect(ed.endReason).toBe('bomb-exploded');

    const lw = makeLevel({ pool, active: ['A', 'B'], cards, config: { deck: 0, wild: 1, cgoal: 9 } });
    const ew = engineOf(lw);
    expect(ew.useWild(0).ok).toBe(true);
    expect(ew.endReason).toBe('bomb-exploded');

    const lc = makeLevel({ pool, active: ['A', 'B'], cards, config: { deck: 0, wild: 0, cgoal: 9 } });
    const ec = engineOf(lc);
    expect(ec.useClaw(0).ok).toBe(true);
    expect(ec.endReason).toBe('bomb-exploded');
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

  it('🎯 수집 미달 + 보드 소진 → collect-unmet 패배 (로더가 필패 레벨을 차단하므로 RuntimeLevel 직접 구성 — 방어 분기 핀)', () => {
    const base = loadLevel(
      makeLevel({
        pool: ['A', 'B', 'C'],
        active: ['A', 'B'],
        cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }],
        config: { deck: 0, wild: 0, objective: 'collect', cgoal: 9 },
        rules: { collectGoal: { symbol: 'A', count: 1 } },
      }),
    );
    const e = new ComboMatchEngine({ ...base, collectGoal: { symbol: 'A', count: 2 } }, {});
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

  it('이동 제한: 와일드 제거는 검사하지 않는다 — 매치 경로 전용 (레퍼런스 준거 핀, 감사: 가드 제거 뮤턴트가 기존 스위트에서 생존했음)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C', 'D', 'X', 'Y'],
      active: ['X', 'Y'], // 어떤 카드와도 공유 없음 — 와일드 강제
      cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }, { symbols: ['C', 'D'] }],
      config: { deck: 0, wild: 3, moves: 1, cgoal: 9 },
    });
    const e = engineOf(l);
    expect(e.useWild(0).ok).toBe(true); // moves 1 = 한도 도달 — 그러나 와일드 경로는 미검사
    expect(e.getState().status).toBe('playing');
    expect(e.tryMatch(1).ok).toBe(true); // 매치 경로에서 비로소 검사: moves 2 ≥ 1, 보드 미완
    expect(e.getState().status).toBe('lost');
    expect(e.endReason).toBe('move-limit');
  });

  it('🗺️ 구역 3단: 하위 구역이 소진될 때마다 순차 개방 (감사 갭)', () => {
    const l = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'C'] }, { symbols: ['A', 'B'], zone: 1 }, { symbols: ['B', 'C'], zone: 2 }],
      config: { deck: 0, wild: 0, cgoal: 9, zones: 3 },
    });
    const e = engineOf(l);
    expect(e.tryMatch(2)).toEqual({ ok: false, reason: 'zone-locked' });
    e.tryMatch(0); // zone0 소진
    expect(e.tryMatch(2)).toEqual({ ok: false, reason: 'zone-locked' }); // zone1 잔존
    e.tryMatch(1); // zone1 소진
    expect(e.tryMatch(2).ok).toBe(true);
    expect(e.getState().status).toBe('won');
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
