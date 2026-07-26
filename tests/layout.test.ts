import { describe, expect, it } from 'vitest';
import { computeLayout, stageSize } from '../src/game/layout';

// 반응형 레이아웃 — 어떤 화면비에서도 UI가 스테이지 안에 들어가고 서로 겹치지 않아야 한다.

const DEVICES: { name: string; vw: number; vh: number; portrait: boolean }[] = [
  { name: '데스크톱 16:9', vw: 1920, vh: 1080, portrait: false },
  { name: '노트북 16:10', vw: 1440, vh: 900, portrait: false },
  { name: '태블릿 가로', vw: 1024, vh: 768, portrait: false },
  { name: '아이폰 세로', vw: 390, vh: 844, portrait: true },
  { name: '안드로이드 세로', vw: 412, vh: 915, portrait: true },
  { name: '아이패드 세로', vw: 820, vh: 1180, portrait: true },
  { name: '정사각에 가까움', vw: 800, vh: 800, portrait: true },
];

describe('stageSize', () => {
  it('스테이지 종횡비가 실제 화면 종횡비에 근접한다 (FIT 여백 최소화)', () => {
    for (const d of DEVICES) {
      const { W, H } = stageSize(d.vw, d.vh);
      const want = d.vw / d.vh;
      const got = W / H;
      // 극단 비율은 상·하한으로 잘리므로 오차를 넉넉히 본다
      expect(Math.abs(got - want) / want, `${d.name}`).toBeLessThan(0.45);
    }
  });

  it('가로/세로를 종횡비로 구분한다', () => {
    for (const d of DEVICES) {
      const { W, H } = stageSize(d.vw, d.vh);
      expect(computeLayout(W, H).portrait, d.name).toBe(d.portrait);
    }
  });

  it('0이나 음수 입력에도 기본 스테이지로 퇴화한다', () => {
    expect(stageSize(0, 0).W).toBeGreaterThan(0);
    expect(stageSize(-100, 500).H).toBeGreaterThan(0);
  });
});

describe('computeLayout', () => {
  const overlaps = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean =>
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

  for (const d of DEVICES) {
    it(`${d.name}: 모든 UI가 스테이지 안에 있다`, () => {
      const { W, H } = stageSize(d.vw, d.vh);
      const L = computeLayout(W, H);

      expect(L.board.y).toBeGreaterThanOrEqual(L.headerH);
      expect(L.board.height).toBeGreaterThan(120);
      expect(L.board.y + L.board.height).toBeLessThanOrEqual(H);
      expect(L.board.x + L.board.width).toBeLessThanOrEqual(W);

      // 보드와 스포트라이트가 겹치지 않는다
      expect(L.spot.y - L.spot.cardH / 2).toBeGreaterThanOrEqual(L.board.y + L.board.height - 4);

      const slots = [
        { name: 'deck', x: L.deck.x, y: L.deck.y, w: L.deck.w, h: L.deck.h },
        { name: 'wild', x: L.wild.x, y: L.wild.y, w: L.wild.w, h: L.wild.h },
        ...L.items.map((it, i) => ({ name: `item${i}`, x: it.x, y: it.y, w: L.itemW, h: L.itemH })),
      ];
      for (const s of slots) {
        expect(s.x - s.w / 2, `${s.name} 좌측`).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2, `${s.name} 우측`).toBeLessThanOrEqual(W);
        expect(s.y + s.h / 2, `${s.name} 하단`).toBeLessThanOrEqual(H + 2);
      }
    });

    it(`${d.name}: 조작 슬롯끼리 겹치지 않는다`, () => {
      const { W, H } = stageSize(d.vw, d.vh);
      const L = computeLayout(W, H);
      const slots = [
        { x: L.deck.x, y: L.deck.y, w: L.deck.w, h: L.deck.h },
        { x: L.wild.x, y: L.wild.y, w: L.wild.w, h: L.wild.h },
        ...L.items.map((it) => ({ x: it.x, y: it.y, w: L.itemW, h: L.itemH })),
      ];
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          expect(overlaps(slots[i]!, slots[j]!), `슬롯 ${i}·${j} 겹침`).toBe(false);
        }
      }
    });
  }

  it('세로 화면은 레벨 선택 열을 줄인다', () => {
    const wide = stageSize(1920, 1080);
    const tall = stageSize(390, 844);
    expect(computeLayout(wide.W, wide.H).selectCols).toBe(4);
    expect(computeLayout(tall.W, tall.H).selectCols).toBeLessThanOrEqual(2);
  });
});
