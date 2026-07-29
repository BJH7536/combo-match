// 레벨 팩 생성기 (100레벨) — tools/level-designer.html의 생성·검증 로직을 그대로 재사용한다.
// 툴의 순수 로직 구간(SYMBOL_GROUPS ~ tierOf)을 런타임에 추출해 실행하므로 규칙이 이중화되지 않는다.
// 사용: node tools/generate-levels.mjs   →  public/levels/*.json 갱신
//
// 설계 (마스터 GDD §5.3 진행 곡선):
//  - 10스테이지 × 10레벨. 스테이지 첫 레벨은 브리더(완화), 후반일수록 조임.
//  - 패턴(레이아웃) 8종을 매 레벨 로테이션 — 연속 레벨은 항상 다른 패턴.
//  - 장치는 4~10번에서 하나씩 도입, 11번부터 주 장치 로테이션 + 후반 보조 장치.
//  - k=2 고정: cardW/cardH 동적 치수는 엔진 미지원(active.md 엔진 갭)이라 팩에서 보류.
//    r=2 스파이크(정확히 같은 쌍 찾기)는 스테이지 9번째 레벨(60번 이후)에만 배치.
//  - 보상 트랙(comboRewards)도 엔진 미지원이라 팩에서 제외 — 시뮬이 보상을 가정하면
//    실제 게임이 검증보다 어려워지므로 지원 전까지 넣지 않는다.
// 검증 (레벨당, 통과할 때까지 시드 스캔):
//  ① 해답 체인 보장(solvableOrder) ② quickValidate 300회 — everClears + 막힘률 밴드
//  ③ 그리디 봇이 시드 1~40 안에 클리어 (tests/level-pack.test.ts와 동일 게이트)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
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
  `${core}\nreturn { generate, quickValidate, difficulty, tierOf, liteOf, runOneSim };`,
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

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

// 패턴 로테이션 — 연속 레벨은 항상 다른 패턴. 초반이 쉬운 순서로 배열.
// (스택은 전역 레이어 캐스케이드가 되어 순차 개방 — 겹침 전부 개방인 격자가 레벨 1 튜토리얼에 적합)
const TOPOS = ['grid', 'stack', 'pyramid', 'tripeaks', 'wave', 'towers', 'diamond', 'composite'];
const STAGE_THEMES = [
  '숲의 입구', '겹겹의 숲', '열쇠의 방', '초읽기 정원', '안개 구역',
  '수집가의 길', '종이의 벽', '폭풍 능선', '미로 심장', '마지막 관문',
];

function planFor(id) {
  const t = (id - 1) / 99;                    // 0..1 진행도
  const stage = Math.ceil(id / 10);
  const pos = ((id - 1) % 10) + 1;            // 스테이지 내 위치 1..10
  const breather = pos === 1 && id > 1;       // 스테이지 첫 레벨 = 브리더

  const cfg = {
    // A 지각 — 곡선 상승 (심볼 풀·유사도·시각 변형)
    N: clamp(6 + 24 * t, 6, 30),
    k: 2,                                     // 엔진 cardW 미지원 → k=2 고정 (파일 상단 주석)
    r: id >= 60 && pos === 9 ? 2 : 1,         // r2 스파이크: 정확히 같은 쌍 찾기
    sim: id < 15 ? 0 : id < 45 ? 1 : 2,
    tf: id < 20 ? 0 : clamp(id - 20, 0, 45),
    // B 구조 — 패턴 로테이션 + 카드·레이어 상승
    topology: TOPOS[(id - 1) % TOPOS.length],
    cards: clamp(8 + 24 * t + (pos - 5) * 0.5, 8, 34),
    layers: clamp(1 + 3.5 * t + (pos > 7 ? 1 : 0), 1, 5),
    // C 자원 — 서서히 조이되 브리더는 완화
    deck: clamp(9 - 4 * t, 5, 9) + (breather ? 1 : 0),
    wild: breather ? 2 : 1,
    moves: 0,
    cgoal: clamp(5 + 6 * t, 5, 12),
    objective: 'clear',
    // D/F 장치 — devicesFor에서 채움
    time: 0, obst: 0, fd: 0, shuffle: false,
    keylocks: 0, bombs: 0, zones: 1, paper: 0,
    rewards: [],
  };
  devicesFor(id, pos, cfg);
  // 🎁 콤보 보상 트랙 (엔진 지급 지원됨): 중간 문턱 = 즉시 골드, 게이지 완성(cgoal) = 와일드 +1.
  // 디자이너 시뮬 봇이 와일드 지급을 실사용하므로 검증 밴드에 그대로 반영된다.
  cfg.rewards = [
    { at: Math.max(3, cfg.cgoal - 2), item: 'gold' },
    { at: cfg.cgoal, item: 'wild' },
  ];

  // 막힘률 밴드: 0.06 → 0.40 선형, 브리더는 30% 완화. 최종 레벨(100)은 보스 예외로 0.45 허용
  const maxStuck = id === 100 ? 0.45 : Math.min(0.4, 0.06 + 0.0035 * (id - 1)) * (breather ? 0.7 : 1);
  return { id, stage, pos, name: `${STAGE_THEMES[stage - 1]} ${pos}`, cfg, maxStuck };
}

// 장치 도입 계획 — 4~10번 단일 도입(학습), 11번부터 주 장치 로테이션 + 후반 보조.
// 드로우 절제(↺): 12번에서 단독 학습 후, 매 스테이지 4번째 레벨(14·24·…·94)이
// 덱 4→2 점감으로 "드로우가 귀한" 레벨이 된다 — C자원 축을 주 레버로 쓰는 스테이지 확대.
function devicesFor(id, pos, cfg) {
  if (id <= 3) return;
  if (id === 4) { cfg.keylocks = 2; return; }
  if (id === 5) { cfg.bombs = 2; return; }
  if (id === 6) { cfg.zones = 2; return; }
  if (id === 7) { cfg.objective = 'collect'; return; }
  if (id === 8) { cfg.paper = 25; return; }
  if (id === 9) { cfg.obst = 15; return; }
  if (id === 10) { cfg.fd = 15; return; }
  if (id === 12) { cfg.deck = 3; return; }  // ↺ 드로우 절제 단독 학습 (다른 장치 없음)
  if (pos === 4 && id >= 14) {              // ↺ 매 스테이지 4번째 = 드로우 제한 레벨
    const t = (id - 1) / 99;
    cfg.deck = Math.max(2, 4 - Math.floor(t * 2)); // 4 → 3 → 2 점감
    cfg.wild = Math.max(cfg.wild, 1);              // 최소한의 구제 수단은 유지
    return;                                        // 주 장치 없이 드로우 압박이 단독 레버
  }
  const main = (id - 11) % 6;
  if (main === 0) cfg.keylocks = id < 40 ? 2 : id < 70 ? 3 : 4;
  else if (main === 1) cfg.bombs = id < 40 ? 1 : id < 70 ? 2 : 3;
  else if (main === 2) cfg.zones = id < 55 ? 2 : 3;
  else if (main === 3) cfg.paper = id < 50 ? 20 : 30;
  else if (main === 4) cfg.fd = id < 50 ? 15 : 25;
  else cfg.obst = id < 50 ? 15 : 25;
  if (pos >= 6 && id >= 21) {                 // 스테이지 후반 보조 장치 1개
    const aux = (id - 21) % 6;
    if (aux === 0 && !cfg.bombs) cfg.bombs = 1;
    else if (aux === 1 && cfg.zones === 1) cfg.zones = 2;
    else if (aux === 2 && !cfg.keylocks) cfg.keylocks = 2;
    else if (aux === 3 && !cfg.paper) cfg.paper = 20;
    else if (aux === 4 && !cfg.fd) cfg.fd = 10;
    else if (!cfg.obst) cfg.obst = 10;
  }
  if (id % 7 === 0) cfg.objective = 'collect';
}

function deviceLabels(cfg) {
  const d = [];
  if (cfg.deck <= 4) d.push('draw'); // ↺ 드로우 제한 — 선택 화면 아이콘용
  if (cfg.keylocks > 0) d.push('key');
  if (cfg.bombs > 0) d.push('bomb');
  if (cfg.zones > 1) d.push('zone');
  if (cfg.objective === 'collect') d.push('collect');
  if (cfg.paper > 0) d.push('paper');
  if (cfg.obst > 0) d.push('lock');
  if (cfg.fd > 0) d.push('facedown');
  if (cfg.r >= 2) d.push('r2');
  return d;
}

// 팩 품질 게이트 ③과 동일: 그리디 봇이 시드 1~40 안에 클리어하는가 (tests/level-pack.test.ts)
function greedyClears40(L) {
  const lite = designer.liteOf(L);
  for (let seed = 1; seed <= 40; seed++) {
    if (designer.runOneSim(lite, seed, 'greedy').cleared) return true;
  }
  return false;
}

function exportLevel(L, plan, diff, val) {
  return {
    schema: 'combo-match/level@2',
    seed: L.config.seed,
    difficulty: +diff.score.toFixed(1),
    difficultyTier: designer.tierOf(diff.score)[0],
    generator: {
      mode: 'levelpack', plan: plan.id, name: plan.name,
      stage: plan.stage, topology: plan.cfg.topology,
    },
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
// 이전 팩 제거 (12개 → 100개 전환 시 잔재 방지)
for (const f of readdirSync(OUT_DIR)) if (/^level-\d+\.json$/.test(f)) unlinkSync(resolve(OUT_DIR, f));

const index = [];
let warns = 0;
const t0 = Date.now();

for (let id = 1; id <= 100; id++) {
  const plan = planFor(id);
  let best = null;
  // 시드를 훑어 "해답 보장 + 막힘률 밴드 + 그리디 40시드 클리어"를 만족하는 첫 레벨을 채택
  for (let seed = 1; seed <= 1200; seed++) {
    const cfg = { ...plan.cfg, seed: id * 1000 + seed };
    const L = designer.generate(cfg);
    if (!L.solvableOrder) continue;
    const val = designer.quickValidate(L, 300);
    if (!val.everClears) continue;
    const diff = designer.difficulty(cfg, val);
    const cand = { L, val, diff, seed };
    if (val.pStuck <= plan.maxStuck && greedyClears40(L)) { best = cand; break; }
    if (!best || val.pStuck < best.val.pStuck) if (greedyClears40(L)) best = cand;
  }
  if (!best) throw new Error(`레벨 ${id}(${plan.name}) 생성 실패 — 조건을 만족하는 시드 없음`);

  const json = exportLevel(best.L, plan, best.diff, best.val);
  const file = `level-${String(id).padStart(3, '0')}.json`;
  writeFileSync(resolve(OUT_DIR, file), JSON.stringify(json), 'utf8');
  index.push({
    id, name: plan.name, file, stage: plan.stage, topology: plan.cfg.topology,
    difficulty: json.difficulty, tier: json.difficultyTier,
    devices: deviceLabels(plan.cfg), cards: json.cards.length,
    pStuck: json.metrics.pStuck, branch: json.metrics.branchFactor,
  });
  const ok = best.val.pStuck <= plan.maxStuck;
  if (!ok) warns++;
  if (id % 10 === 0 || !ok) {
    console.log(
      `${ok ? '  ' : '⚠️'} ${file}  ${plan.name.padEnd(9)} ${plan.cfg.topology.padEnd(9)} ` +
      `난이도 ${json.difficulty.toFixed(0).padStart(2)}(${json.difficultyTier}) ` +
      `카드 ${String(json.cards.length).padStart(2)} 막힘 ${(best.val.pStuck * 100).toFixed(0)}% 분기 ${best.val.branch.toFixed(2)}`,
    );
  }
}

const stages = STAGE_THEMES.map((name, i) => ({
  id: i + 1, name, from: i * 10 + 1, to: i * 10 + 10,
}));
writeFileSync(resolve(OUT_DIR, 'index.json'), JSON.stringify({ stages, levels: index }, null, 2), 'utf8');
console.log(
  `\n레벨 ${index.length}개 생성 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s, 밴드 초과 ${warns}개) → public/levels/`,
);
