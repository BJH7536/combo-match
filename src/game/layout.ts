// 반응형 레이아웃 — 뷰포트 종횡비로 스테이지 크기를 정하고, 모든 UI 위치를 거기서 파생한다.
// Phaser는 FIT으로 스테이지를 화면에 맞추므로, 스테이지 비율이 화면 비율에 가까울수록 여백이 없다.
// 순수 계산이라 유닛 테스트로 검증한다 (Phaser 비의존).

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  W: number;
  H: number;
  portrait: boolean;
  headerH: number;
  board: Rect;
  /** 스포트라이트(액티브 카드) 중심과 카드 규격 */
  spot: { x: number; y: number; cardW: number; cardH: number };
  deck: { x: number; y: number; w: number; h: number };
  /** 힌트·집게 버튼 중심 (순서 고정) */
  items: { x: number; y: number }[];
  itemW: number;
  itemH: number;
  wild: { x: number; y: number; w: number; h: number };
  moves: { x: number; y: number; d: number };
  toastY: number;
  /** 레벨 선택 그리드 열 수 */
  selectCols: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * 뷰포트 종횡비에 맞는 스테이지 크기.
 * 가로는 폭을, 세로는 높이를 기준으로 잡고 반대 축을 비율로 맞춘다.
 */
export function stageSize(vw: number, vh: number): { W: number; H: number } {
  const r = vw > 0 && vh > 0 ? vw / vh : 1280 / 760;
  if (r >= 1.05) {
    // 가로 — 폭 1280 고정, 높이는 비율대로 (너무 납작하거나 길지 않게 제한)
    const W = 1280;
    return { W, H: Math.round(clamp(W / r, 600, 1080)) };
  }
  // 세로 — 높이 1280 고정, 폭은 비율대로
  const H = 1280;
  return { W: Math.round(clamp(H * r, 560, 1180)), H };
}

/** 스테이지 크기에서 모든 UI 슬롯을 계산한다 */
export function computeLayout(W: number, H: number): Layout {
  const portrait = W / H < 1.05;
  const headerH = Math.round(clamp(H * 0.075, 64, 96));

  if (!portrait) {
    // 가로: 보드가 위, 하단 한 줄에 덱 · 아이템 · 스포트라이트 · 이동수/와일드
    const bottomH = Math.round(H * 0.31);
    const boardTop = headerH + Math.round(H * 0.03);
    const spotCardH = Math.round(clamp(bottomH * 0.62, 90, 150));
    const spotCardW = Math.round(spotCardH * 0.806);
    const rowY = H - Math.round(bottomH * 0.42);
    const itemH = Math.round(clamp(bottomH * 0.46, 76, 112));
    const itemW = Math.round(itemH * 0.83);
    const deckH = Math.round(clamp(bottomH * 0.56, 96, 140));
    const deckW = Math.round(deckH * 0.79);
    const wildH = Math.round(clamp(bottomH * 0.49, 86, 122));
    const wildW = Math.round(wildH * 0.79);
    return {
      W,
      H,
      portrait,
      headerH,
      board: { x: W * 0.09, y: boardTop, width: W * 0.82, height: H - bottomH - boardTop - 8 },
      spot: { x: W / 2, y: H - Math.round(bottomH * 0.46), cardW: spotCardW, cardH: spotCardH },
      deck: { x: Math.round(W * 0.11), y: rowY, w: deckW, h: deckH },
      items: [
        { x: Math.round(W * 0.21), y: rowY },
        { x: Math.round(W * 0.286), y: rowY },
      ],
      itemW,
      itemH,
      wild: { x: Math.round(W * 0.928), y: rowY + 8, w: wildW, h: wildH },
      moves: { x: Math.round(W * 0.928), y: rowY - Math.round(wildH * 0.86), d: 78 },
      toastY: H - bottomH - 26,
      selectCols: 4,
    };
  }

  // 세로: 보드가 위 절반, 스포트라이트가 가운데, 조작부가 맨 아래 한 줄
  const barH = Math.round(clamp(H * 0.11, 110, 170)); // 하단 조작 줄
  const spotH = Math.round(clamp(H * 0.16, 130, 220));
  const boardTop = headerH + Math.round(H * 0.02);
  const boardH = H - barH - spotH - boardTop - Math.round(H * 0.04);
  const spotCardH = Math.round(spotH * 0.72);
  const spotCardW = Math.round(spotCardH * 0.806);
  const rowY = H - Math.round(barH * 0.52);
  const itemH = Math.round(clamp(barH * 0.62, 78, 116));
  const itemW = Math.round(itemH * 0.83);
  const deckH = Math.round(clamp(barH * 0.7, 88, 128));
  const deckW = Math.round(deckH * 0.79);
  const wildH = deckH;
  const wildW = deckW;
  return {
    W,
    H,
    portrait,
    headerH,
    board: { x: W * 0.05, y: boardTop, width: W * 0.9, height: boardH },
    spot: { x: W / 2, y: boardTop + boardH + Math.round(spotH * 0.55), cardW: spotCardW, cardH: spotCardH },
    deck: { x: Math.round(W * 0.13), y: rowY, w: deckW, h: deckH },
    items: [
      { x: Math.round(W * 0.38), y: rowY },
      { x: Math.round(W * 0.62), y: rowY },
    ],
    itemW,
    itemH,
    wild: { x: Math.round(W * 0.87), y: rowY, w: wildW, h: wildH },
    moves: { x: Math.round(W * 0.87), y: rowY - deckH - 18, d: 66 },
    toastY: boardTop + boardH + Math.round(spotH * 0.08),
    selectCols: W < 820 ? 2 : 3,
  };
}
