// 골드 지갑 & 정산 — 마스터 GDD §7 경제.
// 공식은 레벨 JSON의 economy 블록(디자이너 툴이 산출)을 그대로 쓰고, 없으면 기본값으로 퇴화한다.

export interface Economy {
  baseGold: number;
  scoreRate: number;
  entryFee: number; // 💰 시도당 입장료 (0 = 무료 — 구버전 레벨·데모)
  drawCost: number; // 💰 드로우 1회 골드 비용 (0 = 무료)
  winMult: number;
  loseMult: number;
  itemPrices: { hint: number; claw: number; wild: number };
}

export const STARTING_GOLD = 200;

/** economy 블록이 없는 레벨(데모·구버전 export)용 기본값 — 레벨 1 기준 */
export const DEFAULT_ECONOMY: Economy = {
  baseGold: 18,
  scoreRate: 0.0175,
  entryFee: 0,
  drawCost: 0,
  winMult: 1,
  loseMult: 0.25,
  itemPrices: { hint: 120, claw: 350, wild: 500 },
};

/** 외부 JSON의 economy를 신뢰하지 않고 형태를 맞춰 정규화한다 */
export function normalizeEconomy(raw: unknown): Economy {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_ECONOMY;
  const e = raw as Partial<Economy> & { itemPrices?: Partial<Economy['itemPrices']> };
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
  return {
    baseGold: num(e.baseGold, DEFAULT_ECONOMY.baseGold),
    scoreRate: num(e.scoreRate, DEFAULT_ECONOMY.scoreRate),
    entryFee: num(e.entryFee, DEFAULT_ECONOMY.entryFee),
    drawCost: num(e.drawCost, DEFAULT_ECONOMY.drawCost),
    winMult: num(e.winMult, DEFAULT_ECONOMY.winMult),
    loseMult: num(e.loseMult, DEFAULT_ECONOMY.loseMult),
    itemPrices: {
      hint: num(e.itemPrices?.hint, DEFAULT_ECONOMY.itemPrices.hint),
      claw: num(e.itemPrices?.claw, DEFAULT_ECONOMY.itemPrices.claw),
      wild: num(e.itemPrices?.wild, DEFAULT_ECONOMY.itemPrices.wild),
    },
  };
}

/** 판 종료 보상 — 승리: 기본골드 + 점수×환율, 패배: 그 값의 loseMult배 (소프트 실패 위로보상 D-5) */
export function payout(eco: Economy, won: boolean, score: number): number {
  const win = eco.baseGold + score * eco.scoreRate;
  return Math.max(0, Math.round(win * (won ? eco.winMult : eco.loseMult)));
}

// ---- 영속 (localStorage 실패는 전부 무시 — 게임이 죽지 않게) ----
const KEY = 'combo-match:gold';

export function loadGold(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return STARTING_GOLD; // 신규 플레이어 지급
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : STARTING_GOLD;
  } catch {
    return STARTING_GOLD;
  }
}

function writeGold(n: number): number {
  const v = Math.max(0, Math.floor(n));
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* 저장 실패는 무시 — 이번 세션에만 반영된다 */
  }
  return v;
}

export function earn(amount: number): number {
  return writeGold(loadGold() + Math.max(0, Math.round(amount)));
}

/** 있는 만큼만 차감 (입장료용 — 골드가 없어도 플레이는 막지 않는다). 반환: 실제 차감액 */
export function spendUpTo(cost: number): { paid: number; gold: number } {
  const gold = loadGold();
  const paid = Math.min(gold, Math.max(0, Math.round(cost)));
  return { paid, gold: writeGold(gold - paid) };
}

/** 잔액이 충분할 때만 차감. 반환: 성공 여부와 차감 후 잔액 */
export function spend(cost: number): { ok: boolean; gold: number } {
  const gold = loadGold();
  if (gold < cost) return { ok: false, gold };
  return { ok: true, gold: writeGold(gold - cost) };
}
