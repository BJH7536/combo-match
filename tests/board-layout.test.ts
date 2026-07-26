import { describe, expect, it } from 'vitest';
import { computeBoardTransform } from '../src/game/board-layout';

describe('board-layout', () => {
  it('보드 바운딩 박스를 뷰포트에 스케일·중앙 정렬한다 (기본 상한 1.6)', () => {
    const cards = [
      { x: 0, y: 0 },
      { x: 136, y: 0 },
      { x: 68, y: 90 },
    ];
    // 바운딩: w = 136+64 = 200, h = 90+80 = 170 → fit 배율 2, 상한 1.6 적용
    const t = computeBoardTransform(cards, 64, 80, { x: 100, y: 50, width: 400, height: 340 });
    expect(t.scale).toBe(1.6);
    expect(t.offsetX).toBe(100 + (400 - 200 * 1.6) / 2);
    expect(t.offsetY).toBe(50 + (340 - 170 * 1.6) / 2);
  });

  it('뷰포트보다 큰 보드는 축소해 완전히 담는다', () => {
    const cards = [
      { x: 0, y: 0 },
      { x: 936, y: 720 },
    ];
    const t = computeBoardTransform(cards, 64, 80, { x: 0, y: 0, width: 500, height: 400 });
    expect(1000 * t.scale).toBeLessThanOrEqual(500);
    expect(800 * t.scale).toBeLessThanOrEqual(400);
    expect(t.offsetX).toBeCloseTo((500 - 1000 * t.scale) / 2);
  });

  it('음수 좌표도 원점 보정되어 뷰포트 안에 정렬된다', () => {
    const cards = [
      { x: -50, y: -30 },
      { x: 50, y: 30 },
    ];
    // w = 100+64 = 164, h = 60+80 = 140, maxScale 1 → scale 1
    const t = computeBoardTransform(cards, 64, 80, { x: 0, y: 0, width: 328, height: 220 }, 1);
    expect(t.scale).toBe(1);
    expect(t.offsetX + -50 * t.scale).toBe((328 - 164) / 2);
    expect(t.offsetY + -30 * t.scale).toBe((220 - 140) / 2);
  });
});
