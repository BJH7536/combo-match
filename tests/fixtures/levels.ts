import type { LevelCardData, LevelConfigData, LevelData, LevelRules } from '../../src/core/types';

// 테스트 픽스처 — 심볼은 가독성을 위해 알파벳 사용 (SymbolId는 임의 문자열)
type CardSpec = Partial<Omit<LevelCardData, 'id' | 'symbols'>> & { symbols: string[] };

export function makeLevel(p: {
  cards: CardSpec[];
  pool: string[];
  active: string[];
  stock?: string[][];
  config?: Partial<LevelConfigData>;
  rules?: LevelRules | null;
  coverage?: { id: number; coveredBy: number[] }[];
  seed?: number;
}): LevelData {
  const n = p.cards.length;
  const stock = p.stock ?? [];
  const config: LevelConfigData = {
    N: p.pool.length,
    k: 2,
    r: 1,
    sim: 0,
    tf: 0,
    cards: n,
    layers: 1,
    topology: 'grid',
    deck: stock.length,
    wild: 0,
    moves: 0,
    cgoal: 5,
    objective: 'clear',
    time: 0,
    obst: 0,
    fd: 0,
    shuffle: false,
    keylocks: 0,
    bombs: 0,
    zones: 1,
    paper: 0,
    seed: p.seed ?? 1,
    ...p.config,
  };
  const cards: LevelCardData[] = p.cards.map((c, i) => ({
    id: i,
    x: (i % 5) * 70,
    y: Math.floor(i / 5) * 90,
    layer: 0,
    symbols: c.symbols,
    lockReq: c.lockReq ?? 0,
    faceDown: c.faceDown ?? false,
    unlockedBy: c.unlockedBy ?? [],
    bombCounter: c.bombCounter ?? 0,
    zone: c.zone ?? 0,
    paper: c.paper ?? false,
    piece: c.piece ?? false,
  }));
  const covMap = new Map((p.coverage ?? []).map((c) => [c.id, c.coveredBy]));
  const coverage = cards.map((c) => ({ id: c.id, coveredBy: covMap.get(c.id)?.slice() ?? [] }));
  return {
    schema: 'combo-match/level@2',
    seed: p.seed ?? 1,
    config,
    pool: p.pool,
    active: p.active,
    deckStock: stock,
    cards,
    coverage,
    rules: p.rules ?? null,
  };
}

// ---- 차등 테스트용 픽스처 (장치 커버리지 다양화) ----

const basic = makeLevel({
  pool: ['A', 'B', 'C', 'D', 'E', 'F'],
  active: ['A', 'B'],
  cards: [
    { symbols: ['A', 'B'] },
    { symbols: ['B', 'C'] },
    { symbols: ['C', 'D'] },
    { symbols: ['D', 'E'] },
    { symbols: ['E', 'F'] },
    { symbols: ['F', 'A'] },
  ],
  stock: [['C', 'D'], ['E', 'F']],
  config: { deck: 4, wild: 1, cgoal: 3 },
});

const pyramid = makeLevel({
  pool: ['A', 'B', 'C', 'D', 'E'],
  active: ['B', 'C'],
  cards: [
    { symbols: ['A', 'B'] }, // 0: 정점 — 1,2에 덮임
    { symbols: ['B', 'C'] }, // 1
    { symbols: ['C', 'D'] }, // 2
    { symbols: ['D', 'E'] }, // 3: free
    { symbols: ['E', 'A'] }, // 4: free
    { symbols: ['A', 'C'] }, // 5: free
  ],
  coverage: [
    { id: 0, coveredBy: [1, 2] },
    { id: 1, coveredBy: [3, 4] },
    { id: 2, coveredBy: [4, 5] },
  ],
  stock: [['A', 'D']],
  config: { deck: 3, wild: 1, cgoal: 4 },
});

const rTwo = makeLevel({
  pool: ['A', 'B', 'C', 'D', 'E'],
  active: ['B', 'C', 'D'],
  cards: [
    { symbols: ['A', 'B', 'C'] },
    { symbols: ['B', 'C', 'D'] },
    { symbols: ['C', 'D', 'E'] },
    { symbols: ['A', 'B', 'D'] },
    { symbols: ['B', 'D', 'E'] },
  ],
  stock: [['A', 'C', 'D']],
  config: { k: 3, r: 2, deck: 3, wild: 1, cgoal: 3 },
});

const devices = makeLevel({
  pool: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  active: ['A', 'B'],
  cards: [
    { symbols: ['A', 'B'], piece: true }, // 0: zone0, 조각
    { symbols: ['B', 'C'] }, // 1: zone0 — 6번의 열쇠
    { symbols: ['C', 'D'] }, // 2: zone0
    { symbols: ['D', 'E'], piece: true }, // 3: zone0, 조각
    { symbols: ['E', 'F'] }, // 4: zone0
    { symbols: ['F', 'G'], zone: 1 }, // 5
    { symbols: ['G', 'H'], zone: 1, unlockedBy: [1] }, // 6: 열쇠 필요
    { symbols: ['H', 'A'], zone: 1, lockReq: 2 }, // 7: 콤보 잠금
    { symbols: ['A', 'C'], zone: 1, bombCounter: 14 }, // 8: 폭탄
    { symbols: ['B', 'D'], zone: 1, paper: true }, // 9: 종이
  ],
  stock: [['C', 'E'], ['F', 'H']],
  config: { deck: 6, wild: 2, cgoal: 4, zones: 2 },
  rules: { paper: { piecesNeeded: 2, count: 1 } },
});

const collect = makeLevel({
  pool: ['A', 'B', 'C', 'D'],
  active: ['A', 'B'],
  cards: [
    { symbols: ['A', 'B'] },
    { symbols: ['A', 'C'] },
    { symbols: ['B', 'C'] },
    { symbols: ['A', 'D'] },
    { symbols: ['C', 'D'] },
    { symbols: ['A', 'C'] },
  ],
  stock: [['B', 'D']],
  config: { deck: 3, wild: 1, objective: 'collect', cgoal: 3 },
  rules: { collectGoal: { symbol: 'A', count: 3, available: 4 } },
});

const bombTight = makeLevel({
  pool: ['A', 'B', 'C', 'D'],
  active: ['A', 'B'],
  cards: [
    { symbols: ['A', 'B'] },
    { symbols: ['B', 'C'] },
    { symbols: ['C', 'D'] },
    { symbols: ['D', 'A'] },
    { symbols: ['A', 'C'], bombCounter: 3 },
  ],
  stock: [['B', 'D']],
  config: { deck: 2, wild: 1, cgoal: 3 },
});

const moveLimited = makeLevel({
  pool: ['A', 'B', 'C', 'D'],
  active: ['A', 'B'],
  cards: [
    { symbols: ['A', 'B'] },
    { symbols: ['B', 'C'] },
    { symbols: ['C', 'D'] },
    { symbols: ['D', 'A'] },
    { symbols: ['A', 'C'] },
    { symbols: ['B', 'D'], faceDown: true },
  ],
  stock: [['C', 'A']],
  config: { deck: 2, wild: 1, moves: 3, cgoal: 3 },
});

export const DIFF_FIXTURES: { name: string; level: LevelData }[] = [
  { name: 'basic', level: basic },
  { name: 'pyramid', level: pyramid },
  { name: 'r-two', level: rTwo },
  { name: 'devices', level: devices },
  { name: 'collect', level: collect },
  { name: 'bomb-tight', level: bombTight },
  { name: 'move-limited', level: moveLimited },
];
