import { describe, expect, it } from 'vitest';
import { ComboMatchEngine } from '../src/core/engine';
import { loadLevel } from '../src/core/level-loader';
import type { LevelData, SymbolId } from '../src/core/types';
import { DIFF_FIXTURES } from './fixtures/levels';
import { liteFromLevelJson, runOneSimTraced } from './reference/reference-sim';

// 차등 테스트: 레퍼런스(runOneSim verbatim 사본)가 기록한 행동열을 우리 엔진으로 재생해
// 매 스텝의 콤보·점수·제거 수와 최종 결과가 일치함을 단언한다. 규칙 동작 동치의 증명.

interface TraceEvent {
  t: 'm' | 'w' | 'd';
  id?: number;
  active?: SymbolId[];
  combo: number;
  score: number;
  removedCount: number;
}

function replayAgainstReference(level: LevelData, seed: number, policy: 'greedy' | 'random') {
  const ref = runOneSimTraced(liteFromLevelJson(level), seed, policy) as {
    cleared: boolean;
    moves: number;
    score: number;
    why: 'collect' | 'bomb' | 'move-limit' | 'exhausted' | 'natural';
    trace: TraceEvent[];
  };
  let pendingFallback: SymbolId[] | null = null;
  const engine = new ComboMatchEngine(loadLevel(level), {
    drawFallback: () => {
      const a = pendingFallback;
      pendingFallback = null;
      if (!a) throw new Error('기록되지 않은 fallback 드로우');
      return a.slice();
    },
  });

  for (const ev of ref.trace) {
    if (ev.t === 'm') {
      const r = engine.tryMatch(ev.id!);
      expect(r.ok, `match #${ev.id} (seed ${seed})`).toBe(true);
    } else if (ev.t === 'w') {
      const r = engine.useWild(ev.id!);
      expect(r.ok, `wild #${ev.id} (seed ${seed})`).toBe(true);
    } else {
      pendingFallback = ev.active!;
      const r = engine.draw();
      expect(r.ok, `draw (seed ${seed})`).toBe(true);
      if (r.ok) expect(r.active).toEqual(ev.active);
    }
    const s = engine.getState();
    expect(s.combo, `combo (seed ${seed})`).toBe(ev.combo);
    expect(s.score, `score (seed ${seed})`).toBe(ev.score);
    expect(s.removedCount, `removed (seed ${seed})`).toBe(ev.removedCount);
  }

  const s = engine.getState();
  expect(s.moves, `moves (seed ${seed})`).toBe(ref.moves);
  expect(s.score, `final score (seed ${seed})`).toBe(ref.score);
  // 종료 상태·사유까지 단언 (감사: endReason 미단언 시 사유 왜곡 뮤턴트가 전량 생존했음)
  if (ref.cleared) {
    expect(s.status, `won 기대 (seed ${seed})`).toBe('won');
    expect(engine.endReason, `승리 사유 (seed ${seed})`).toBe(
      ref.why === 'collect' ? 'collect-goal' : 'board-cleared',
    );
  } else if (ref.why === 'exhausted') {
    // 자원 소진 막힘 — 엔진은 패배를 선언하지 않고 playing+stuck (패배 선언은 세션 계층 소유, D-5)
    expect(s.status === 'playing' && engine.isStuck(), `stuck 기대 (seed ${seed})`).toBe(true);
  } else {
    const reasonMap = { bomb: 'bomb-exploded', 'move-limit': 'move-limit', natural: 'collect-unmet' } as const;
    expect(s.status, `lost 기대 (seed ${seed})`).toBe('lost');
    expect(engine.endReason, `패배 사유 (seed ${seed})`).toBe(reasonMap[ref.why as keyof typeof reasonMap]);
  }
}

describe('레퍼런스 동작 동치 (트레이스 재생)', () => {
  const seeds = Array.from({ length: 15 }, (_, i) => i + 1);
  for (const { name, level } of DIFF_FIXTURES) {
    for (const policy of ['greedy', 'random'] as const) {
      it(`${name} × ${policy} × 시드 15종`, () => {
        for (const seed of seeds) replayAgainstReference(level, seed, policy);
      });
    }
  }
});
