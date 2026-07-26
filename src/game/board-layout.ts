// 보드 배치 변환 — 레벨 좌표(디자이너 툴 공간, 카드 64×80 기준)를 뷰포트에 맞춰
// 스케일·중앙 정렬한다. 순수 함수 (Phaser 비의존, 유닛 테스트 대상).

export interface BoardTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeBoardTransform(
  cards: readonly { x: number; y: number }[],
  cardW: number,
  cardH: number,
  view: Viewport,
  maxScale = 1.6,
): BoardTransform {
  const xs = cards.map((c) => c.x);
  const ys = cards.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + cardW;
  const h = Math.max(...ys) - minY + cardH;
  const scale = Math.min(maxScale, view.width / w, view.height / h);
  return {
    scale,
    offsetX: view.x + (view.width - w * scale) / 2 - minX * scale,
    offsetY: view.y + (view.height - h * scale) / 2 - minY * scale,
  };
}
