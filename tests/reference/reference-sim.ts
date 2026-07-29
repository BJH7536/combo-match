// @ts-nocheck
/* 기획자 레퍼런스 구현의 verbatim 사본 + 트레이스 계측.
   출처: tools/level-designer.html (mulberry32/shareCount: 줄 381~382, runOneSim: 줄 537~612,
   liteOf: 줄 615~624 — export JSON 형태에 맞게 coverage 어댑터만 추가).
   ⚠️ 규칙 로직 수정 금지 — 차등 테스트(differential.test.ts)의 기준이다.
   원본에 추가된 계측은 트레이스(trace.push)와 종료 사유(fin의 why 인자) 둘뿐이다. */

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shareCount(a, b) {
  let n = 0;
  const S = new Set(a);
  for (const x of b) if (S.has(x)) n++;
  return n;
}

export function runOneSimTraced(L, seed, policy) {
  const rng = mulberry32(seed >>> 0);
  const N = L.cards.length;
  const removed = new Array(N).fill(false);
  let removedCount = 0;
  let active = L.active.slice(),
    deck = L.deckN,
    wild = L.wildN;
  let combo = 0,
    moves = 0,
    deckUsed = 0,
    wildUsed = 0,
    maxCombo = 0,
    score = 0,
    collected = 0,
    pieces = 0;
  const goal = L.collectGoal || null,
    paperNeed = L.paperNeed || 0;
  // 🎁 콤보 보상 트랙 (원본 checkRewards 사본 — 엔진과 동치인 wild/deck만 반영.
  // 원본의 claw 충전은 트레이스로 재생 불가한 행동이라 제외 — 팩·픽스처에는 claw 보상 없음)
  const rewards = L.rewards || [],
    rewardGot = rewards.map(() => false);
  function checkRewards() {
    for (let i = 0; i < rewards.length; i++) {
      if (rewardGot[i] || combo < rewards[i].at) continue;
      rewardGot[i] = true;
      if (rewards[i].item === 'wild') wild++;
      else if (rewards[i].item === 'deck') deck++;
    }
  }
  const stock = L.stock.map((s) => s.slice());
  const maxMoves = L.moveLimit > 0 ? L.moveLimit : N * 6;
  let branchSum = 0,
    branchN = 0,
    safety = 0;
  const trace = []; // 계측 추가
  function isFree(i) {
    const cb = L.coveredBy[i];
    for (let j = 0; j < cb.length; j++) if (!removed[cb[j]]) return false;
    return true;
  }
  function drawActive() {
    if (stock.length) return stock.pop();
    const arr = L.pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr.slice(0, L.k);
  }
  const bombs = [];
  for (let i = 0; i < N; i++) if (L.cards[i].bombCounter) bombs.push({ i, c: L.cards[i].bombCounter });
  const zoneCount = [0, 0, 0, 0];
  let maxZone = 0;
  for (let i = 0; i < N; i++) {
    const z = L.cards[i].zone || 0;
    zoneCount[z]++;
    if (z > maxZone) maxZone = z;
  }
  function activeZone() {
    for (let z = 0; z <= maxZone; z++) if (zoneCount[z] > 0) return z;
    return maxZone;
  }
  function tickBombs() {
    for (const b of bombs) if (!removed[b.i] && --b.c <= 0) return true;
    return false;
  }
  function pickBest(list) {
    if (policy !== 'greedy') return list[Math.floor(rng() * list.length)];
    let bombPick = null,
      bc = 1e9;
    for (const i of list) {
      const b = bombs.find((x) => x.i === i && !removed[i]);
      if (b && b.c < bc) {
        bc = b.c;
        bombPick = i;
      }
    }
    if (bombPick != null) return bombPick;
    let best = -1,
      bi = [];
    for (const i of list) {
      const s = L.coversCount[i];
      if (s > best) {
        best = s;
        bi = [i];
      } else if (s === best) bi.push(i);
    }
    return bi[Math.floor(rng() * bi.length)];
  }
  function fin(cleared, why) {
    // why 계측 추가: collect | bomb | move-limit | exhausted | natural
    return {
      cleared,
      moves,
      deckUsed,
      wildUsed,
      maxCombo,
      score,
      branch: branchN ? branchSum / branchN : 0,
      why,
      trace,
    };
  }
  while (removedCount < N && safety++ < N * 20) {
    const freeIdx = [];
    for (let i = 0; i < N; i++) if (!removed[i] && isFree(i)) freeIdx.push(i);
    const az = activeZone();
    const unlockOk = (i) => {
      const ub = L.cards[i].unlockedBy;
      if (!ub || !ub.length) return true;
      for (let j = 0; j < ub.length; j++) if (!removed[ub[j]]) return false;
      return true;
    };
    const gateOk = (i) =>
      (L.cards[i].zone || 0) <= az && unlockOk(i) && (!L.cards[i].paper || pieces >= paperNeed);
    const valid = [];
    for (const i of freeIdx) {
      const c = L.cards[i];
      if (gateOk(i) && combo >= (c.lockReq || 0) && shareCount(c.symbols, active) >= L.r) valid.push(i);
    }
    branchSum += valid.length;
    branchN++;
    if (valid.length) {
      const pick = pickBest(valid);
      removed[pick] = true;
      removedCount++;
      zoneCount[L.cards[pick].zone || 0]--;
      if (L.cards[pick].piece) pieces++;
      active = L.cards[pick].symbols.slice();
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      moves++;
      checkRewards(); // 🎁 콤보 증가 직후 지급 (원본 동일)
      score += 10 * combo;
      if (L.cgoal && combo % L.cgoal === 0) score += 100 * combo;
      trace.push({ t: 'm', id: pick, combo, score, removedCount }); // 계측
      if (goal && L.cards[pick].symbols.indexOf(goal.symbol) >= 0 && ++collected >= goal.count)
        return fin(true, 'collect');
      if (tickBombs()) return fin(false, 'bomb');
      if (L.moveLimit > 0 && moves >= maxMoves && removedCount < N) return fin(false, 'move-limit');
      continue;
    }
    if (deck > 0) {
      deck--;
      deckUsed++;
      combo = 0;
      active = drawActive();
      trace.push({ t: 'd', active: active.slice(), combo, score, removedCount }); // 계측
      if (tickBombs()) return fin(false, 'bomb');
      continue;
    }
    if (wild > 0) {
      const wildable = freeIdx.filter(gateOk);
      if (wildable.length) {
        wild--;
        wildUsed++;
        const pick = pickBest(wildable);
        removed[pick] = true;
        removedCount++;
        zoneCount[L.cards[pick].zone || 0]--;
        if (L.cards[pick].piece) pieces++;
        active = L.cards[pick].symbols.slice();
        combo = Math.max(1, combo);
        checkRewards(); // 🎁 와일드 경로도 지급 검사 (원본 동일)
        score += 10 * combo;
        moves++;
        trace.push({ t: 'w', id: pick, combo, score, removedCount }); // 계측
        if (goal && L.cards[pick].symbols.indexOf(goal.symbol) >= 0 && ++collected >= goal.count)
          return fin(true, 'collect');
        if (tickBombs()) return fin(false, 'bomb');
        continue;
      }
    }
    return fin(false, 'exhausted');
  }
  return fin(goal ? collected >= goal.count : removedCount >= N, 'natural');
}

// export JSON(level@2) → 시뮬레이션 경량 구조 (원본 liteOf의 coverage 어댑터판)
export function liteFromLevelJson(level) {
  const N = level.cards.length;
  const coveredBy = Array.from({ length: N }, () => []);
  for (const c of level.coverage) coveredBy[c.id] = c.coveredBy.slice();
  const cc = new Array(N).fill(0);
  coveredBy.forEach((list) => list.forEach((a) => cc[a]++));
  const rules = level.rules || {};
  return {
    cards: level.cards.map((c) => ({
      symbols: c.symbols,
      lockReq: c.lockReq || 0,
      unlockedBy: c.unlockedBy || [],
      bombCounter: c.bombCounter || 0,
      zone: c.zone || 0,
      paper: !!c.paper,
      piece: !!c.piece,
    })),
    paperNeed: rules.paper ? rules.paper.piecesNeeded : 0,
    coveredBy,
    coversCount: cc,
    pool: level.pool,
    active: level.active,
    stock: level.deckStock,
    r: level.config.r,
    k: level.config.k,
    cgoal: level.config.cgoal,
    deckN: level.config.deck,
    wildN: level.config.wild,
    moveLimit: level.config.moves,
    collectGoal: rules.collectGoal
      ? { symbol: rules.collectGoal.symbol, count: rules.collectGoal.count }
      : null,
    // 🎁 엔진과 동치인 즉시 사용형만 (로더의 필터와 동일 — gold는 게임플레이 무영향이라 생략)
    rewards: (rules.comboRewards || []).filter((r) => ['wild', 'deck'].includes(r.item)),
  };
}
