import type { LevelData, RuntimeLevel } from './types';

// level@2 로드 검증 — fail-fast (card-model GDD의 검증 소유권 계승, 스키마는 마스터 §8)
export class LevelLoadError extends Error {
  constructor(message: string) {
    super(`level@2 load: ${message}`);
    this.name = 'LevelLoadError';
  }
}

export function loadLevel(data: LevelData): RuntimeLevel {
  if (typeof data.schema !== 'string' || !data.schema.startsWith('combo-match/level@')) {
    throw new LevelLoadError(`알 수 없는 스키마: ${String(data.schema)}`);
  }
  // 신뢰 불가 채널(#level=<base64>·localStorage) 대비 — 구조 분해 전에 최상위 형태부터 fail-fast
  if (typeof data.config !== 'object' || data.config === null) throw new LevelLoadError('config 없음');
  for (const f of ['cards', 'coverage', 'pool', 'active', 'deckStock'] as const) {
    if (!Array.isArray(data[f])) throw new LevelLoadError(`${f}가 배열이 아님`);
  }
  if (typeof data.seed !== 'number' || !Number.isFinite(data.seed)) {
    throw new LevelLoadError(`seed 무효: ${String(data.seed)}`);
  }
  const { config, cards, coverage, pool } = data;
  const n = cards.length;
  if (n === 0) throw new LevelLoadError('카드가 없음');
  if (!Number.isInteger(config.k) || config.k < 1) throw new LevelLoadError(`k 무효: ${config.k}`);
  if (!Number.isInteger(config.r) || config.r < 1) throw new LevelLoadError(`r 무효: ${config.r}`);
  if (config.r > config.k) throw new LevelLoadError(`r(${config.r}) > k(${config.k})`);
  // 비숫자(undefined/NaN)도 차단 — 엔진 자원 가드는 부정형(<=0)이라 NaN에서 무한 드로우·무한 와일드가 된다 (감사)
  for (const key of ['deck', 'wild', 'moves'] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 0) {
      throw new LevelLoadError(`${key} 무효: ${config[key]} (0 이상 정수)`);
    }
  }
  if (!Number.isInteger(config.cgoal) || config.cgoal < 0) {
    throw new LevelLoadError(`cgoal 무효: ${config.cgoal} (0=비활성, 그 외 양의 정수)`);
  }

  const poolSet = new Set(pool);
  if (poolSet.size !== pool.length) throw new LevelLoadError('pool에 중복 심볼');
  const inPool = (syms: readonly string[], where: string): void => {
    for (const s of syms) {
      if (!poolSet.has(s)) throw new LevelLoadError(`${where}의 심볼 ${s}이 pool에 없음`);
    }
  };

  // 카드: id = index 보장 (레퍼런스 구현의 id-인덱스 동일성 관례)
  cards.forEach((c, i) => {
    if (typeof c !== 'object' || c === null) throw new LevelLoadError(`cards[${i}]가 객체가 아님`);
    if (c.id !== i) throw new LevelLoadError(`cards[${i}].id=${c.id} — id는 index와 일치해야 함`);
    if (!Array.isArray(c.symbols)) throw new LevelLoadError(`카드 ${i} symbols가 배열이 아님`);
    if (c.symbols.length < 1 || c.symbols.length > 6) {
      throw new LevelLoadError(`카드 ${i} 심볼 수 ${c.symbols.length} (1~6 허용)`);
    }
    if (new Set(c.symbols).size !== c.symbols.length) {
      throw new LevelLoadError(`카드 ${i}에 중복 심볼`);
    }
    inPool(c.symbols, `카드 ${i}`);
    // F계층 필드는 부재를 허용하고(level@1 호환 — 레퍼런스도 ||0 정규화) 값이 있을 때만 엄격 검증한다.
    // 정규화는 아래 반환부에서 일괄 수행하므로 엔진은 항상 완전한 카드만 본다.
    if (c.unlockedBy !== undefined) {
      if (!Array.isArray(c.unlockedBy)) throw new LevelLoadError(`카드 ${i} unlockedBy가 배열이 아님`);
      for (const k of c.unlockedBy) {
        if (!Number.isInteger(k) || k < 0 || k >= n) throw new LevelLoadError(`카드 ${i}의 열쇠 참조 무효: ${k}`);
        if (k === i) throw new LevelLoadError(`카드 ${i}가 자기 자신을 열쇠로 참조`);
      }
    }
    if (c.lockReq !== undefined && (!Number.isInteger(c.lockReq) || c.lockReq < 0)) {
      throw new LevelLoadError(`카드 ${i} lockReq 무효: ${c.lockReq}`);
    }
    if (c.bombCounter !== undefined && (!Number.isInteger(c.bombCounter) || c.bombCounter < 0)) {
      throw new LevelLoadError(`카드 ${i} bombCounter 무효: ${c.bombCounter}`);
    }
    if (c.zone !== undefined && (!Number.isInteger(c.zone) || c.zone < 0 || c.zone > 3)) {
      throw new LevelLoadError(`카드 ${i} zone 무효: ${c.zone} (0~3 정수)`);
    }
  });
  inPool(data.active, 'active');
  data.deckStock.forEach((s, i) => {
    if (!Array.isArray(s)) throw new LevelLoadError(`deckStock[${i}]가 배열이 아님`);
    inPool(s, `deckStock[${i}]`);
  });

  // coverage → coveredBy 배열 (전 카드 항목 필수, 참조 무결성)
  const coveredBy: number[][] = Array.from({ length: n }, () => []);
  const seen = new Set<number>();
  for (const entry of coverage) {
    if (typeof entry !== 'object' || entry === null || !Array.isArray(entry.coveredBy)) {
      throw new LevelLoadError('coverage 항목 형태 무효 (id + coveredBy 배열 필수)');
    }
    if (!Number.isInteger(entry.id) || entry.id < 0 || entry.id >= n) {
      throw new LevelLoadError(`coverage id 무효: ${entry.id}`);
    }
    if (seen.has(entry.id)) throw new LevelLoadError(`coverage id 중복: ${entry.id}`);
    seen.add(entry.id);
    for (const c of entry.coveredBy) {
      if (!Number.isInteger(c) || c < 0 || c >= n) throw new LevelLoadError(`coverage 참조 무효: ${entry.id}←${c}`);
      if (c === entry.id) throw new LevelLoadError(`카드 ${c}가 자기 자신을 덮음`);
    }
    coveredBy[entry.id] = entry.coveredBy.slice();
  }
  if (seen.size !== n) throw new LevelLoadError(`coverage 누락 — ${n}장 중 ${seen.size}장만 기재`);

  // 덮임 그래프 순환 검사 (위상 제거 시뮬레이션 — 전 카드 제거 가능해야 함)
  {
    const removed = new Array<boolean>(n).fill(false);
    let removedCount = 0;
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (let i = 0; i < n; i++) {
        if (!removed[i] && coveredBy[i]!.every((c) => removed[c])) {
          removed[i] = true;
          removedCount++;
          progressed = true;
        }
      }
    }
    if (removedCount !== n) throw new LevelLoadError('coverage 순환 — 구조적으로 제거 불가한 카드 존재');
  }

  const rules = data.rules ?? null;
  const paperCount = cards.filter((c) => c.paper === true).length;
  const pieceCount = cards.filter((c) => c.piece === true).length;
  const paperNeed = rules?.paper?.piecesNeeded ?? 0;
  if (paperCount > 0 && paperNeed <= 0) throw new LevelLoadError('종이 카드가 있는데 rules.paper 없음');
  if (paperNeed > pieceCount) throw new LevelLoadError(`piecesNeeded(${paperNeed}) > 조각 카드 수(${pieceCount})`);
  const collectGoal = rules?.collectGoal ?? null;
  if (collectGoal) {
    if (!poolSet.has(collectGoal.symbol)) throw new LevelLoadError('collectGoal 심볼이 pool에 없음');
    if (!Number.isInteger(collectGoal.count) || collectGoal.count < 1) {
      throw new LevelLoadError(`collectGoal.count 무효: ${collectGoal.count}`);
    }
    // 달성 가능성 — 보유량 초과 목표는 구조적 필패 (종이 piecesNeeded 검사와 동형, 감사)
    const holders = cards.filter((c) => c.symbols.includes(collectGoal.symbol)).length;
    if (collectGoal.count > holders) {
      throw new LevelLoadError(`collectGoal.count(${collectGoal.count}) > 목표 심볼 보유 카드 수(${holders})`);
    }
  }
  const scoreGoalRule = rules?.scoreGoal ?? null;
  if (scoreGoalRule && (!Number.isInteger(scoreGoalRule.score) || scoreGoalRule.score < 1)) {
    throw new LevelLoadError(`scoreGoal.score 무효: ${scoreGoalRule.score} (1 이상 정수)`);
  }

  return {
    // 방어 복사 + F계층 정규화 — 부재 필드에 레퍼런스와 동일한 기본값을 채워 엔진에 넘긴다
    cards: cards.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      layer: c.layer,
      symbols: c.symbols.slice(),
      lockReq: c.lockReq ?? 0,
      faceDown: c.faceDown === true,
      unlockedBy: (c.unlockedBy ?? []).slice(),
      bombCounter: c.bombCounter ?? 0,
      zone: c.zone ?? 0,
      paper: c.paper === true,
      piece: c.piece === true,
    })),
    coveredBy,
    pool: pool.slice(),
    initialActive: data.active.slice(),
    deckStock: data.deckStock.map((s) => s.slice()),
    k: config.k,
    r: config.r,
    cgoal: config.cgoal,
    deck: config.deck,
    wild: config.wild,
    moveLimit: config.moves,
    collectGoal: collectGoal ? { symbol: collectGoal.symbol, count: collectGoal.count } : null,
    paperNeed,
    scoreGoal: scoreGoalRule?.score ?? null,
    seed: data.seed,
  };
}
