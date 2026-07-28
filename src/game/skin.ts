import Phaser from 'phaser';

// 우드 콘솔 스킨 — ui_draft.html의 CSS 그라디언트·질감을 런타임 CanvasTexture로 재현한다.
// 외부 이미지 에셋 없이 번들만으로 그리므로 초기 로드 예산(3초)에 영향이 없다.

export const PALETTE = {
  feltInner: '#5aad3a',
  feltMid: '#3c7f2c',
  feltOuter: '#2f6b24',
  woodBarTop: '#8a5a2c',
  woodBarBottom: '#6b431e',
  woodDeep: '#4a2c11',
  woodLightTop: '#a6703a',
  woodLightBottom: '#7c4f24',
  woodChipTop: '#c98b47',
  woodChipBottom: '#9c6229',
  woodChipShadow: '#5c3411',
  goldTop: '#f3d98f',
  goldBottom: '#c79a3e',
  goldShadow: '#8a5f16',
  goldText: '#5c3d08',
  cardTop: '#ffffff',
  cardBottom: '#f3ead8',
  cardEdge: '#e7d9bb',
  orangeTop: '#ffb43a',
  orangeBottom: '#f27311',
  orangeShadow: '#c2540c',
  deckTop: '#5a3fb0',
  deckBottom: '#3d2a86',
  deckShadow: '#251a52',
  cream: '#ffe6bf',
  hintEdge: '#7ed957', // 튜토리얼 매칭 가능 표시 (시안의 초록 글로우)
} as const;

export interface PanelStyle {
  top: string;
  bottom: string;
  /** 아래로 깔리는 단색 입체 그림자 (CSS `0 Npx 0 색`) */
  shadow?: string;
  shadowDepth?: number;
  radius?: number;
  /** 나무 결 스트라이프 오버레이 */
  grain?: boolean;
  /** 테두리 색 + 두께 */
  edge?: string;
  edgeWidth?: number;
  /** 점선 테두리 (와일드카드 슬롯) */
  dashed?: boolean;
  /** 바깥 발광 (color, blur) */
  glow?: { color: string; blur: number };
  /** 상단 하이라이트 (CSS inset 0 2px 0 rgba(255,255,255,.x)) */
  gloss?: number;
}

const PAD = 16; // 그림자·발광이 잘리지 않도록 텍스처 여백

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// CSS repeating-linear-gradient(96deg, ...) 근사 — 거의 수직인 결 스트라이프
function paintGrain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Phaser.Math.DegToRad(6));
  const span = Math.max(w, h) * 1.6;
  for (let i = -span; i < span; i += 7) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(i, -span / 2, 3, span);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(i + 3, -span / 2, 4, span);
  }
  ctx.restore();
}

// 이미 구운 텍스처는 반드시 재사용한다 — 같은 키를 remove/재생성하면 그 텍스처를 참조 중인
// GameObject의 frame.source가 null이 되어 렌더 루프가 glTexture 접근에서 죽는다.
// 크기 비교는 소스 캔버스 실측으로 한다 (Texture에는 width/height 프로퍼티가 없다).
// 캔버스는 정수 픽셀만 가지므로 규격을 반올림해서 만들고 비교한다. 소수로 비교하면 매번
// 불일치 → remove/재생성이 되고, 그 텍스처를 참조 중인 GameObject의 frame.source가 null이 되어
// 렌더 루프가 glTexture 접근에서 죽는다.
function reuseCanvas(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture | null {
  const iw = Math.round(w);
  const ih = Math.round(h);
  if (scene.textures.exists(key)) {
    const src = scene.textures.get(key).getSourceImage();
    if (src && src.width === iw && src.height === ih) return null;
    scene.textures.remove(key);
  }
  return scene.textures.createCanvas(key, iw, ih) ?? null;
}

/** 라운드 패널 텍스처 (나무·골드·오렌지·덱 박스 공용). 반환: 텍스처 키 */
export function panelTexture(scene: Phaser.Scene, key: string, rawW: number, rawH: number, s: PanelStyle): string {
  const w = Math.round(rawW);
  const h = Math.round(rawH);
  const tex = reuseCanvas(scene, key, w + PAD * 2, h + PAD * 2);
  if (!tex) return key;
  const ctx = tex.getContext();
  const radius = s.radius ?? 12;
  const depth = s.shadowDepth ?? 4;

  ctx.save();
  if (s.shadow) {
    ctx.fillStyle = s.shadow;
    roundRect(ctx, PAD, PAD + depth, w, h, radius);
    ctx.fill();
  }
  if (s.glow) {
    ctx.shadowColor = s.glow.color;
    ctx.shadowBlur = s.glow.blur;
  }
  const g = ctx.createLinearGradient(0, PAD, 0, PAD + h);
  g.addColorStop(0, s.top);
  g.addColorStop(1, s.bottom);
  ctx.fillStyle = g;
  roundRect(ctx, PAD, PAD, w, h, radius);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (s.grain) {
    ctx.save();
    roundRect(ctx, PAD, PAD, w, h, radius);
    ctx.clip();
    paintGrain(ctx, PAD, PAD, w, h);
    ctx.restore();
  }
  if (s.gloss) {
    ctx.fillStyle = `rgba(255,255,255,${s.gloss})`;
    roundRect(ctx, PAD + radius * 0.4, PAD + 1.5, w - radius * 0.8, 3, 2);
    ctx.fill();
  }
  if (s.edge) {
    ctx.strokeStyle = s.edge;
    ctx.lineWidth = s.edgeWidth ?? 3;
    if (s.dashed) ctx.setLineDash([9, 7]);
    roundRect(ctx, PAD, PAD, w, h, radius);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  tex.refresh();
  return key;
}

// 'hint' = 매칭 가능 표시. 상시 표시는 폐기(D-2)이고 튜토리얼 1~3에서만 쓴다(ADR-001 결정 2·O-3).
export type CardVariant = 'face' | 'covered' | 'back' | 'hint' | 'paper' | 'gated';

/** 카드 텍스처 — 크기가 레벨마다 다르므로 키에 규격을 포함한다 */
export function cardTexture(scene: Phaser.Scene, rawW: number, rawH: number, variant: CardVariant): string {
  const w = Math.round(rawW);
  const h = Math.round(rawH);
  const key = `card-${variant}-${w}x${h}`;
  const tex = reuseCanvas(scene, key, w + PAD * 2, h + PAD * 2);
  if (!tex) return key;
  const ctx = tex.getContext();
  const radius = Math.max(8, h * 0.11);
  const edgeW = Math.max(2, h * 0.022);

  ctx.save();
  // 입체 그림자 (CSS 0 6px 0 rgba(0,0,0,.16) + 0 9px 15px rgba(0,0,0,.2))
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.shadowColor = 'rgba(0,0,0,0.30)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  roundRect(ctx, PAD, PAD + h * 0.045, w, h, radius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const g = ctx.createLinearGradient(0, PAD, 0, PAD + h);
  if (variant === 'face' || variant === 'hint') {
    g.addColorStop(0, PALETTE.cardTop);
    g.addColorStop(1, PALETTE.cardBottom);
  } else if (variant === 'covered') {
    g.addColorStop(0, '#cdbfa4');
    g.addColorStop(1, '#ab9c80');
  } else if (variant === 'paper') {
    // 🧻 종이에 싸인 카드 — 확실히 "종이"로 읽히는 밝은 크라프트 톤
    g.addColorStop(0, '#eee1c4');
    g.addColorStop(1, '#dccda6');
  } else if (variant === 'gated') {
    // 🚧 게이트(구역·열쇠·콤보 잠금)에 막힌 카드 — 차가운 회청색으로 "지금은 못 집음"을 즉시 구분
    g.addColorStop(0, '#b6bcc6');
    g.addColorStop(1, '#949ca8');
  } else {
    g.addColorStop(0, PALETTE.woodLightTop);
    g.addColorStop(1, PALETTE.woodLightBottom);
  }
  ctx.fillStyle = g;
  roundRect(ctx, PAD, PAD, w, h, radius);
  ctx.fill();

  if (variant === 'back') {
    ctx.save();
    roundRect(ctx, PAD, PAD, w, h, radius);
    ctx.clip();
    paintGrain(ctx, PAD, PAD, w, h);
    ctx.restore();
  }

  if (variant === 'paper') {
    // 대각선 줄무늬 — 기획 시안(play-reference)의 repeating-linear-gradient(45deg) 재현
    ctx.save();
    roundRect(ctx, PAD, PAD, w, h, radius);
    ctx.clip();
    ctx.strokeStyle = 'rgba(122,101,62,0.22)';
    ctx.lineWidth = Math.max(4, h * 0.07);
    for (let d = -h; d < w + h; d += Math.max(10, h * 0.17)) {
      ctx.beginPath();
      ctx.moveTo(PAD + d, PAD + h);
      ctx.lineTo(PAD + d + h, PAD);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (variant === 'hint') {
    // 시안의 초록 글로우를 튜토리얼 전용으로 되살린다 (ADR-001 O-3 재정의)
    ctx.shadowColor = 'rgba(126,217,87,0.9)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = PALETTE.hintEdge;
    ctx.lineWidth = edgeW * 1.9;
  } else if (variant === 'paper') {
    ctx.strokeStyle = '#b39a63';
    ctx.lineWidth = edgeW * 1.4;
    ctx.setLineDash([Math.max(5, h * 0.08), Math.max(4, h * 0.06)]); // 점선 = "뜯을 수 있는 포장"
  } else if (variant === 'gated') {
    ctx.strokeStyle = '#6d747f';
    ctx.lineWidth = edgeW * 1.4;
  } else {
    ctx.strokeStyle = variant === 'back' ? PALETTE.woodDeep : PALETTE.cardEdge;
    ctx.lineWidth = edgeW;
  }
  roundRect(ctx, PAD + edgeW / 2, PAD + edgeW / 2, w - edgeW, h - edgeW, radius);
  ctx.stroke();
  ctx.restore();
  tex.refresh();
  return key;
}

/** 펠트 보드 배경 — radial-gradient(120% 100% at 50% 15%) */
export function feltTexture(scene: Phaser.Scene, key: string, rawW: number, rawH: number): string {
  const w = Math.round(rawW);
  const h = Math.round(rawH);
  const tex = reuseCanvas(scene, key, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(w / 2, h * 0.15, 0, w / 2, h * 0.15, Math.max(w, h) * 1.05);
  g.addColorStop(0, PALETTE.feltInner);
  g.addColorStop(0.68, PALETTE.feltMid);
  g.addColorStop(1, PALETTE.feltOuter);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 안쪽 비네트 (CSS inset 0 0 50px rgba(0,0,0,.45))
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
  return key;
}

/** 스포트라이트 광선 — repeating-conic-gradient 근사 (회전 트윈용 정사각 텍스처) */
export function raysTexture(scene: Phaser.Scene, key: string, size: number): string {
  const tex = reuseCanvas(scene, key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const c = size / 2;
  ctx.fillStyle = 'rgba(255,245,205,0.32)';
  for (let deg = 0; deg < 360; deg += 16) {
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c, Phaser.Math.DegToRad(deg), Phaser.Math.DegToRad(deg + 5));
    ctx.closePath();
    ctx.fill();
  }
  tex.refresh();
  return key;
}

/** 스포트라이트 주변 어둠 — 중앙은 투명, 바깥은 배경으로 페이드되는 원형 비네트 */
export function haloTexture(scene: Phaser.Scene, key: string, size: number, rgb: string, peakAlpha: number): string {
  const tex = reuseCanvas(scene, key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, c * 0.3, c, c, c);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(0.55, `rgba(${rgb},${peakAlpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`); // 사각 모서리가 드러나지 않도록 바깥까지 페이드
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
  return key;
}
