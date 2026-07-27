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
  /** 기준 스테이지(가로 1280 / 세로 720) 대비 배율 — 고정 크기 글자에 곱해 쓴다 */
  ui: number;
  /** 보드 카드가 커질 수 있는 상한 배율 (해상도를 올려도 상대 크기가 유지되도록 ui를 곱해 둔다) */
  cardMaxScale: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// 렌더 부담 상한 — 이 픽셀 수를 넘으면 비율을 유지한 채 줄인다 (대략 2380×1340)
const MAX_PIXELS = 3_200_000;

/**
 * 스테이지 크기 = 화면에 실제로 표시될 픽셀 수.
 * 캔버스 내부 해상도를 표시 크기에 맞춰야 업스케일 흐림이 없다.
 * dpr 3 화면(요즘 폰 대부분)에서 2배만 그리면 브라우저가 1.5배 늘려 흐려지므로 3까지 반영하고,
 * 렌더 부담은 총 픽셀 수 상한으로 막는다.
 */
export function stageSize(vw: number, vh: number, dpr = 1): { W: number; H: number } {
  const cssW = vw > 0 ? vw : 1280;
  const cssH = vh > 0 ? vh : 760;
  const k = clamp(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, 1, 3);
  let W = Math.round(cssW * k);
  let H = Math.round(cssH * k);
  const px = W * H;
  if (px > MAX_PIXELS) {
    const shrink = Math.sqrt(MAX_PIXELS / px);
    W = Math.floor(W * shrink);
    H = Math.floor(H * shrink);
  }
  // 지나치게 작은 창에서도 레이아웃이 성립하도록 하한을 둔다
  if (W < 480 || H < 480) {
    const grow = Math.max(480 / W, 480 / H);
    W = Math.round(W * grow);
    H = Math.round(H * grow);
  }
  return { W, H };
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
    const ui = clamp(W / 1280, 0.62, 2.1);
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
      selectCols: W < 900 ? 3 : 4,
      ui,
      cardMaxScale: 1.4 * ui,
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
  const ui = clamp(W / 720, 0.62, 2.1);
  return {
    W,
    H,
    portrait,
    headerH,
    // 레벨 보드는 가로로 긴 띠라 세로 화면에서는 폭이 곧 카드 크기다 — 좌우 여백을 최소로 남긴다
    board: { x: W * 0.015, y: boardTop, width: W * 0.97, height: boardH },
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
    // 폰이냐 태블릿이냐를 가른다. W는 dpr이 곱해진 값이므로 임계도 물리 픽셀 기준이어야 한다
    // (가장 큰 폰이 430css×3 ≈ 1290, 가장 작은 세로 태블릿이 768css×2 = 1536)
    selectCols: W < 1350 ? 2 : 3,
    ui,
    // 세로는 보드 위아래가 크게 남으므로(폭 제약) 상한을 풀어 좁은 레벨이라도 크게 보이게 한다
    cardMaxScale: 1.9 * ui,
  };
}
