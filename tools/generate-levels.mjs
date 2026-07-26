// 레벨 팩 생성기 — tools/level-designer.html의 생성·검증 로직을 그대로 재사용한다.
// 툴의 순수 로직 구간(SYMBOL_GROUPS ~ tierOf)을 런타임에 추출해 실행하므로 규칙이 이중화되지 않는다.
// 사용: node tools/generate-levels.mjs   →  public/levels/*.json 갱신
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/levels');

// ---- 디자이너 툴에서 생성 로직 추출 ----
const html = readFileSync(resolve(ROOT, 'tools/level-designer.html'), 'utf8').split('\n');
const START = html.findIndex((l) => l.startsWith('const SYMBOL_GROUPS'));
const END = html.findIndex((l) => l.startsWith('function tierOf'));
if (START < 0 || END < 0) throw new Error('디자이너 툴에서 생성 로직 구간을 찾지 못했습니다');
const core = html.slice(START, END + 3).join('\n'); // tierOf 본문(3줄) 포함
const designer = new Function(
  `${core}\nreturn { generate, quickValidate, difficulty, tierOf };`,
)();

// 툴의 economyOf (DOM 의존 구간 밖에 있어 별도 정의 — 마스터 GDD §7과 동일 공식)
const economyOf = (levelIndex, diffScore) => ({
  levelIndex,
  baseGold: Math.round(15 + 3 * levelIndex),
  scoreRate: +(0.01 * (1 + diffScore / 40)).toFixed(4),
  winMult: 1,
  loseMult: 0.25,
  itemPrices: { hint: 120, claw: 350, wild: 500 },
});

const base = {
  sim: 0, tf: 0, topology: 'pyramid', time: 0, obst: 0, fd: 0,
  shuffle: false, keylocks: 0, bombs: 0, zones: 1, paper: 0,
  moves: 0, objective: 'clear', seed: 1,
};

// 난이도 곡선: design/difficulty-elements.md §3 — 한 레벨에서 새로 올리는 계층은 하나씩.
// 장치는 4번부터 하나씩 도입하고 10번 이후 복합한다.
const PLAN = [
  { id: 1,  name: '첫 만남',       devices: [],                  maxStuck: 0.06, cfg: { N: 6,  k: 2, r: 1, cards: 8,  layers: 1, topology: 'grid', deck: 8, wild: 1, cgoal: 5 } },
  { id: 2,  name: '겹친 카드',     devices: [],                  maxStuck: 0.10, cfg: { N: 7,  k: 2, r: 1, cards: 11, layers: 2, deck: 7, wild: 1, cgoal: 5 } },
  { id: 3,  name: '늘어난 그림',   devices: [],                  maxStuck: 0.14, cfg: { N: 9,  k: 2, r: 1, cards: 14, layers: 2, deck: 6, wild: 1, cgoal: 6 } },
  { id: 4,  name: '열쇠와 자물쇠', devices: ['key'],             maxStuck: 0.22, cfg: { N: 10, k: 2, r: 1, cards: 15, layers: 2, deck: 6, wild: 1, cgoal: 6, keylocks: 2 } },
  { id: 5,  name: '초읽기',        devices: ['bomb'],            maxStuck: 0.26, cfg: { N: 10, k: 2, r: 1, cards: 15, layers: 3, deck: 6, wild: 1, cgoal: 6, bombs: 2 } },
  { id: 6,  name: '구역 개방',     devices: ['zone'],            maxStuck: 0.28, cfg: { N: 12, k: 2, r: 1, cards: 17, layers: 3, deck: 6, wild: 1, cgoal: 7, zones: 2 } },
  // 7번부터 유사 심볼군(sim)을 올려 지각 난이도를 더한다 — 같은 계열 과일이 섞여 탐색이 어려워진다
  { id: 7,  name: '수집가',        devices: ['collect'],         maxStuck: 0.32, cfg: { N: 11, k: 2, r: 1, cards: 16, layers: 2, topology: 'grid', deck: 6, wild: 1, cgoal: 7, objective: 'collect', sim: 1 } },
  { id: 8,  name: '찢어진 종이',   devices: ['paper'],           maxStuck: 0.34, cfg: { N: 12, k: 2, r: 1, cards: 18, layers: 3, deck: 6, wild: 1, cgoal: 7, paper: 25, sim: 1 } },
  { id: 9,  name: '두 개를 맞춰',  devices: ['r2'],              maxStuck: 0.38, cfg: { N: 12, k: 3, r: 2, cards: 16, layers: 3, deck: 7, wild: 1, cgoal: 8, sim: 1 } },
  { id: 10, name: '자물쇠 창고',   devices: ['key', 'bomb', 'lock'], maxStuck: 0.30, cfg: { N: 14, k: 2, r: 1, cards: 20, layers: 4, deck: 6, wild: 1, cgoal: 8, keylocks: 2, bombs: 2, obst: 15, sim: 2 } },
  { id: 11, name: '가려진 구역',   devices: ['zone', 'paper', 'facedown'], maxStuck: 0.30, cfg: { N: 14, k: 2, r: 1, cards: 20, layers: 3, deck: 6, wild: 1, cgoal: 9, zones: 3, paper: 20, fd: 15, sim: 2 } },
  { id: 12, name: '마지막 관문',   devices: ['key', 'bomb', 'zone', 'r2'], maxStuck: 0.35, cfg: { N: 15, k: 3, r: 2, cards: 22, layers: 4, deck: 7, wild: 2, cgoal: 10, keylocks: 3, bombs: 2, zones: 2, sim: 2 } },
];

function exportLevel(L, plan, diff, val) {
  return {
    schema: 'combo-match/level@2',
    seed: L.config.seed,
    difficulty: +diff.score.toFixed(1),
    difficultyTier: designer.tierOf(diff.score)[0],
    generator: { mode: 'levelpack', plan: plan.id, name: plan.name },
    metrics: {
      pStuck: +val.pStuck.toFixed(3),
      branchFactor: +val.branch.toFixed(2),
      avgMoves: +val.avgMoves.toFixed(1),
      solvable: L.solvableOrder && val.everClears,
    },
    evaluation: null,
    economy: economyOf(plan.id, diff.score),
    rules: L.rules || null,
    config: L.config,
    pool: L.pool,
    active: L.active,
    deckStock: L.stock,
    cards: L.cards.map((c) => ({
      id: c.id, x: Math.round(c.x), y: Math.round(c.y), layer: c.layer,
      symbols: c.symbols, lockReq: c.lockReq, faceDown: c.faceDown,
      unlockedBy: c.unlockedBy || [], bombCounter: c.bombCounter || 0,
      zone: c.zone || 0, paper: !!c.paper, piece: !!c.piece,
    })),
    coverage: L.coveredBy.map((cb, i) => ({ id: i, coveredBy: cb })),
  };
}

mkdirSync(OUT_DIR, { recursive: true });
const index = [];

for (const plan of PLAN) {
  let best = null;
  // 시드를 훑어 "항상 클리어 가능 + 막힘 확률이 등급 상한 이내"인 첫 레벨을 채택한다.
  for (let seed = 1; seed <= 400; seed++) {
    const cfg = { ...base, ...plan.cfg, seed };
    const L = designer.generate(cfg);
    if (!L.solvableOrder) continue;
    const val = designer.quickValidate(L, 300);
    if (!val.everClears) continue;
    const diff = designer.difficulty(cfg, val);
    const cand = { L, val, diff, seed };
    if (val.pStuck <= plan.maxStuck) { best = cand; break; }
    // 상한을 못 맞추면 가장 순한 후보라도 남겨 둔다
    if (!best || val.pStuck < best.val.pStuck) best = cand;
  }
  if (!best) throw new Error(`레벨 ${plan.id}(${plan.name}) 생성 실패 — 조건을 만족하는 시드 없음`);

  const json = exportLevel(best.L, plan, best.diff, best.val);
  const file = `level-${String(plan.id).padStart(2, '0')}.json`;
  writeFileSync(resolve(OUT_DIR, file), JSON.stringify(json, null, 2), 'utf8');
  index.push({
    id: plan.id, name: plan.name, file,
    difficulty: json.difficulty, tier: json.difficultyTier,
    devices: plan.devices, cards: json.cards.length,
    pStuck: json.metrics.pStuck, branch: json.metrics.branchFactor,
  });
  const flag = best.val.pStuck <= plan.maxStuck ? '  ' : '⚠️';
  console.log(
    `${flag} ${file}  ${plan.name.padEnd(8)} seed=${String(best.seed).padStart(3)} ` +
    `난이도 ${json.difficulty.toFixed(0).padStart(2)}(${json.difficultyTier}) ` +
    `카드 ${json.cards.length} 막힘 ${(best.val.pStuck * 100).toFixed(0)}% 분기 ${best.val.branch.toFixed(2)}`,
  );
}

writeFileSync(resolve(OUT_DIR, 'index.json'), JSON.stringify({ levels: index }, null, 2), 'utf8');
console.log(`\n레벨 ${index.length}개 생성 완료 → public/levels/`);
