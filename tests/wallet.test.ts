import { describe, expect, it } from 'vitest';
import { DEFAULT_ECONOMY, normalizeEconomy, payout, type Economy } from '../src/game/wallet';
import levelOne from '../public/levels/level-01.json';

// 마스터 GDD §7 경제 — 정산 공식과 외부 economy 블록 정규화.
// localStorage 래퍼(loadGold/earn/spend)는 브라우저 전용이라 여기서는 순수 계산만 다룬다.

const eco: Economy = {
  baseGold: 18,
  scoreRate: 0.02,
  winMult: 1,
  loseMult: 0.25,
  itemPrices: { hint: 120, claw: 350, wild: 500 },
};

describe('정산 (payout)', () => {
  it('승리: 기본골드 + 점수×환율 (반올림)', () => {
    expect(payout(eco, true, 0)).toBe(18);
    expect(payout(eco, true, 1000)).toBe(38); // 18 + 20
    expect(payout(eco, true, 890)).toBe(36); // 18 + 17.8 = 35.8 → 36
  });

  it('패배: 승리 보상의 loseMult배 — 0이 아니라 위로보상이 남는다 (D-5)', () => {
    expect(payout(eco, false, 1000)).toBe(10); // 38 × 0.25 = 9.5 → 10
    expect(payout(eco, false, 0)).toBe(5); // 18 × 0.25 = 4.5 → 5
    expect(payout(eco, false, 0)).toBeGreaterThan(0);
  });

  it('점수가 높을수록 보상이 커지고, 승리가 항상 패배보다 많다', () => {
    expect(payout(eco, true, 2000)).toBeGreaterThan(payout(eco, true, 500));
    expect(payout(eco, true, 500)).toBeGreaterThan(payout(eco, false, 500));
  });
});

describe('economy 블록 정규화', () => {
  it('레벨 팩의 실제 economy 블록을 그대로 받아들인다', () => {
    const e = normalizeEconomy((levelOne as { economy: unknown }).economy);
    expect(e.baseGold).toBe(18); // 15 + 3×1
    expect(e.itemPrices).toEqual({ hint: 120, claw: 350, wild: 500 });
    expect(e.loseMult).toBe(0.25);
  });

  it('없거나 깨진 입력은 기본값으로 퇴화한다 (신뢰 불가 채널 대비)', () => {
    expect(normalizeEconomy(null)).toEqual(DEFAULT_ECONOMY);
    expect(normalizeEconomy('nope')).toEqual(DEFAULT_ECONOMY);
    expect(normalizeEconomy({})).toEqual(DEFAULT_ECONOMY);
    const partial = normalizeEconomy({ baseGold: 50, itemPrices: { claw: 99 } });
    expect(partial.baseGold).toBe(50);
    expect(partial.itemPrices.claw).toBe(99);
    expect(partial.itemPrices.hint).toBe(DEFAULT_ECONOMY.itemPrices.hint);
    expect(normalizeEconomy({ baseGold: -5, scoreRate: NaN }).baseGold).toBe(DEFAULT_ECONOMY.baseGold);
  });
});
