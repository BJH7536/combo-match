import { describe, expect, it } from 'vitest';
import levelIndexJson from '../public/levels/index.json';
import { ComboMatchEngine } from '../src/core/engine';
import { loadLevel } from '../src/core/level-loader';
import type { LevelData, SymbolId } from '../src/core/types';
import { liteFromLevelJson, runOneSimTraced } from './reference/reference-sim';

// 배포되는 레벨 팩(public/levels)의 품질 게이트.
// 로더 통과 + 레퍼런스 봇이 실제로 클리어 + 그 플레이를 우리 엔진이 동일하게 재현하는지 검증한다.
// tools/generate-levels.mjs로 레벨을 다시 뽑아도 이 테스트가 회귀를 잡는다.

const levelModules = import.meta.glob<{ default: LevelData }>('../public/levels/level-*.json', {
  eager: true,
});
const readJson = (file: string): LevelData => {
  const mod = levelModules[`../public/levels/${file}`];
  if (!mod) throw new Error(`레벨 파일을 찾을 수 없음: ${file}`);
  return mod.default;
};

interface IndexEntry {
  id: number;
  name: string;
  file: string;
  stage: number;
  topology: string;
  difficulty: number;
  tier: string;
  devices: string[];
  cards: number;
  pStuck: number;
  branch: number;
}
const index = levelIndexJson as {
  stages: { id: number; name: string; from: number; to: number }[];
  levels: IndexEntry[];
};

interface TraceEvent {
  t: 'm' | 'w' | 'd';
  id?: number;
  active?: SymbolId[];
  combo: number;
  score: number;
  removedCount: number;
}

describe('레벨 팩 (public/levels)', () => {
  it('인덱스에 100개 레벨이 10스테이지로 등재되어 있다', () => {
    expect(index.levels).toHaveLength(100);
    const ids = index.levels.map((l) => l.id);
    expect(ids).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(index.stages).toHaveLength(10);
    for (const s of index.stages) expect(s.to - s.from).toBe(9);
    for (const l of index.levels) expect(l.stage).toBe(Math.ceil(l.id / 10));
    for (let i = 1; i < index.levels.length; i++) {
      // 난이도는 단조 증가까지는 아니어도 앞 구간이 뒤 구간보다 어려우면 안 된다
      expect(index.levels[i]!.difficulty).toBeGreaterThanOrEqual(index.levels[0]!.difficulty);
    }
  });

  it('패턴(레이아웃)이 매 레벨 다르다 — 연속 레벨은 항상 다른 토폴로지', () => {
    for (let i = 1; i < index.levels.length; i++) {
      expect(index.levels[i]!.topology).not.toBe(index.levels[i - 1]!.topology);
    }
    // 8종 토폴로지가 팩 전체에서 모두 사용된다
    const used = new Set(index.levels.map((l) => l.topology));
    expect([...used].sort()).toEqual(
      ['composite', 'diamond', 'grid', 'pyramid', 'stack', 'towers', 'tripeaks', 'wave'].sort(),
    );
  });

  it('장치 7종이 팩 전체에서 최소 한 번씩 등장한다', () => {
    const seen = new Set<string>();
    for (const entry of index.levels) {
      const lv = readJson(entry.file);
      for (const c of lv.cards) {
        if (c.lockReq && c.lockReq > 0) seen.add('lock');
        if (c.unlockedBy && c.unlockedBy.length > 0) seen.add('key');
        if (c.bombCounter && c.bombCounter > 0) seen.add('bomb');
        if (c.zone && c.zone > 0) seen.add('zone');
        if (c.paper) seen.add('paper');
        if (c.piece) seen.add('piece');
        if (c.faceDown) seen.add('faceDown');
      }
      if (lv.rules?.collectGoal) seen.add('collect');
    }
    expect([...seen].sort()).toEqual(
      ['bomb', 'collect', 'faceDown', 'key', 'lock', 'paper', 'piece', 'zone'].sort(),
    );
  });

  for (const entry of index.levels) {
    it(`${entry.file} (${entry.name}) — 로드·클리어 가능·엔진 동치`, () => {
      const data = readJson(entry.file);
      const rt = loadLevel(data); // 스키마 검증 (실패 시 LevelLoadError)
      expect(rt.cards).toHaveLength(entry.cards);

      // 레퍼런스 봇이 클리어하는 시드를 찾고, 그 플레이를 우리 엔진으로 재생해 동치를 확인한다
      const lite = liteFromLevelJson(data);
      let cleared: { trace: TraceEvent[]; score: number; moves: number } | null = null;
      for (let seed = 1; seed <= 40 && !cleared; seed++) {
        const r = runOneSimTraced(lite, seed, 'greedy') as {
          cleared: boolean;
          score: number;
          moves: number;
          trace: TraceEvent[];
        };
        if (r.cleared) cleared = r;
      }
      expect(cleared, `${entry.file}: 40시드 안에 클리어하는 플레이가 없음`).not.toBeNull();

      let pending: SymbolId[] | null = null;
      const engine = new ComboMatchEngine(loadLevel(data), {
        drawFallback: () => {
          const a = pending;
          pending = null;
          if (!a) throw new Error('기록되지 않은 fallback 드로우');
          return a.slice();
        },
      });
      for (const ev of cleared!.trace) {
        if (ev.t === 'm') expect(engine.tryMatch(ev.id!).ok, `match #${ev.id}`).toBe(true);
        else if (ev.t === 'w') expect(engine.useWild(ev.id!).ok, `wild #${ev.id}`).toBe(true);
        else {
          pending = ev.active!;
          expect(engine.draw().ok).toBe(true);
        }
        const s = engine.getState();
        expect(s.combo).toBe(ev.combo);
        expect(s.score).toBe(ev.score);
        expect(s.removedCount).toBe(ev.removedCount);
      }
      expect(engine.getState().status).toBe('won');
      expect(engine.getState().score).toBe(cleared!.score);
    });
  }
});
