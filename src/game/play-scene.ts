import Phaser from 'phaser';
import { ComboMatchEngine, type EndReason, type RejectReason } from '../core/engine';
import { LevelLoadError, loadLevel } from '../core/level-loader';
import type { LevelData, RuntimeCard, RuntimeLevel, SymbolId } from '../core/types';
import { computeBoardTransform } from './board-layout';
import { hasSeenHelp, showHelpOverlay } from './help-overlay';
import type { LevelIndexEntry } from './level-select-scene';
import { decodeLevelHash, demoLevel } from './level-source';
import { saveResult } from './progress';
import { earn, type Economy, loadGold, normalizeEconomy, payout, spend } from './wallet';
import { cardTexture, feltTexture, haloTexture, PALETTE, panelTexture, raysTexture } from './skin';

// 플레이 씬 — 보드 렌더·입력·HUD. 시각 기준: ui_draft.html (우드 콘솔 W2 스포트라이트).
// 규칙 상태는 전부 엔진 소유 — 씬은 이벤트 구독 + 행동 호출만 한다.

const STAGE_W = 1280;
const STAGE_H = 760;
const DATA_CW = 64; // 레벨 좌표 공간의 카드 규격 (디자이너 툴 CW/CH)
const DATA_CH = 80;
const HEADER_H = 80;
const BOARD_VIEW = { x: 120, y: 104, width: 1040, height: 420 };
const SPOT = { x: STAGE_W / 2, y: 654 }; // 스포트라이트(액티브 카드) 중심
const SPOT_CARD_W = 108;
const SPOT_CARD_H = 134;

const FONT = "'Segoe UI', 'Malgun Gothic', sans-serif";

const REJECT_MSG: Record<RejectReason, string> = {
  'game-over': '게임이 끝났습니다',
  'not-found': '이미 제거된 카드예요',
  covered: '위에 카드가 덮여 있어요',
  'zone-locked': '아직 잠긴 구역이에요',
  'key-locked': '열쇠 카드를 먼저 제거하세요',
  'paper-locked': '조각을 모아야 열려요',
  'combo-locked': '콤보가 더 필요해요',
  'no-shared-symbol': '같은 그림이 없어요',
  'deck-empty': '덱을 모두 썼습니다',
  'no-wild': '와일드카드가 없습니다',
};
const END_MSG: Record<EndReason, string> = {
  'board-cleared': '보드 클리어!',
  'collect-goal': '수집 목표 달성!',
  'score-goal': '점수 목표 달성!',
  'bomb-exploded': '폭탄이 터졌습니다',
  'move-limit': '이동 횟수를 모두 썼습니다',
  'collect-unmet': '수집 목표 미달',
};

interface CardNode {
  root: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  symbolText: Phaser.GameObjects.Text;
  badgeText: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

export class PlayScene extends Phaser.Scene {
  private engine!: ComboMatchEngine;
  private level!: RuntimeLevel;
  private nodes = new Map<number, CardNode>();
  private bombCounters = new Map<number, number>();
  private armed: 'none' | 'wild' | 'claw' = 'none'; // 다음 카드 클릭을 어떤 아이템이 가로챌지
  private tutorial = false; // 레벨 1~3: 매칭 가능 카드를 초록으로 표시 (ADR-001 결정 2)
  private matchable = new Set<number>();
  private gold = 0;
  private eco: Economy = normalizeEconomy(null);
  private settled = false; // 정산은 판당 1회
  private ended = false;
  private cardW = 0;
  private cardH = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private gaugeFill!: Phaser.GameObjects.Rectangle;
  private gaugeText!: Phaser.GameObjects.Text;
  private comboBadge!: Phaser.GameObjects.Container;
  private comboValue!: Phaser.GameObjects.Text;
  private comboFlames!: Phaser.GameObjects.Text;
  private spotSymbols!: Phaser.GameObjects.Text;
  private deckCount!: Phaser.GameObjects.Text;
  private wildCount!: Phaser.GameObjects.Text;
  private wildSlot!: Phaser.GameObjects.Image;
  private wildHint!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private itemButtons: { key: 'hint' | 'claw'; bg: Phaser.GameObjects.Image; price: Phaser.GameObjects.Text }[] = [];
  private movesText: Phaser.GameObjects.Text | null = null;
  private toastText!: Phaser.GameObjects.Text;

  private initData: { level?: LevelData; entry?: LevelIndexEntry } = {};

  constructor() {
    super('Play');
  }

  init(data?: { level?: LevelData; entry?: LevelIndexEntry }): void {
    this.initData = data ?? {};
  }

  create(): void {
    this.nodes.clear();
    this.bombCounters.clear();
    this.armed = 'none';
    this.itemButtons = [];
    this.matchable.clear();
    this.tutorial = (this.initData.entry?.id ?? 99) <= 3;
    this.settled = false;
    this.gold = loadGold();
    this.eco = normalizeEconomy((this.initData.level as { economy?: unknown } | undefined)?.economy);
    this.ended = false;

    const { level, sourceLabel } = this.resolveLevel();
    this.level = level;
    this.engine = new ComboMatchEngine(level, {});
    for (const c of level.cards) if (c.bombCounter > 0) this.bombCounters.set(c.id, c.bombCounter);

    this.buildBackdrop();
    this.buildBoard();
    this.buildHeader(sourceLabel);
    this.buildSpotlight();
    this.buildSideConsoles();
    this.wireEngineEvents();
    this.refreshAllCards();
    this.updateHud();

    // 첫 플레이 1회 — 매칭 규칙을 모르면 무슨 게임인지 알 수 없다
    if (!hasSeenHelp()) showHelpOverlay(this);
  }

  private resolveLevel(): { level: RuntimeLevel; sourceLabel: string } {
    // 레벨 선택에서 넘어온 경우가 최우선, 그 다음 디자이너 해시, 마지막이 내장 데모
    if (this.initData.level) {
      try {
        const entry = this.initData.entry;
        return {
          level: loadLevel(this.initData.level),
          sourceLabel: entry ? `${entry.id}. ${entry.name}` : '레벨',
        };
      } catch (e) {
        console.warn(`레벨 로드 실패 — 데모로 폴백: ${String(e)}`);
      }
    }
    const fromHash = decodeLevelHash(window.location.hash);
    if (fromHash) {
      try {
        return { level: loadLevel(fromHash), sourceLabel: '디자이너 레벨' };
      } catch (e) {
        const msg = e instanceof LevelLoadError ? e.message : String(e);
        console.warn(`레벨 해시 로드 실패 — 데모로 폴백: ${msg}`);
      }
    }
    return { level: loadLevel(demoLevel()), sourceLabel: '데모 레벨' };
  }

  // ---- 배경 ----
  private buildBackdrop(): void {
    this.add.image(STAGE_W / 2, STAGE_H / 2, feltTexture(this, 'felt', STAGE_W, STAGE_H));
    // 하단 나무 받침 (시안의 wood base ledge)
    this.add
      .image(
        STAGE_W / 2,
        STAGE_H - 18,
        panelTexture(this, 'ledge', 520, 60, {
          top: PALETTE.woodLightTop,
          bottom: PALETTE.woodLightBottom,
          radius: 30,
          grain: true,
        }),
      )
      .setDepth(1);
  }

  // ---- 보드 ----
  private buildBoard(): void {
    const t = computeBoardTransform(this.level.cards, DATA_CW, DATA_CH, BOARD_VIEW, 1.4);
    this.cardW = DATA_CW * t.scale;
    this.cardH = DATA_CH * t.scale;
    const w = this.cardW;
    const h = this.cardH;
    // 텍스처를 미리 굽는다 (카드 규격은 레벨 내 동일)
    cardTexture(this, w, h, 'face');
    cardTexture(this, w, h, 'covered');
    cardTexture(this, w, h, 'back');
    if (this.tutorial) cardTexture(this, w, h, 'hint');

    for (const card of this.level.cards) {
      const cx = t.offsetX + (card.x + DATA_CW / 2) * t.scale;
      const cy = t.offsetY + (card.y + DATA_CH / 2) * t.scale;
      const root = this.add.container(cx, cy).setDepth(100 + card.layer * 1000 + card.y);

      const image = this.add.image(0, 0, cardTexture(this, w, h, 'face'));
      const symbolText = this.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: `${Math.round((card.symbols.length <= 2 ? 0.34 : 0.24) * h)}px`,
          color: '#2b1f12',
          align: 'center',
        })
        .setOrigin(0.5);
      const badgeText = this.add
        .text(-w / 2 + 5, -h / 2 + 4, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.13)}px`, color: '#2b1f12' })
        .setOrigin(0, 0);
      root.add([image, symbolText, badgeText]);

      root.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
      root.on('pointerdown', () => this.onCardTap(card.id));
      root.on('pointerover', () => {
        if (!this.ended && this.engine.isFree(card.id)) root.setY(cy - 4);
      });
      root.on('pointerout', () => root.setY(cy));
      this.nodes.set(card.id, { root, image, symbolText, badgeText, w, h });
    }
  }

  private symbolLines(symbols: readonly SymbolId[]): string {
    if (symbols.length <= 3) return symbols.join(' ');
    const lines: string[] = [];
    for (let i = 0; i < symbols.length; i += 2) lines.push(symbols.slice(i, i + 2).join(' '));
    return lines.join('\n');
  }

  private badgeOf(card: RuntimeCard): string {
    const parts: string[] = [];
    const bomb = this.bombCounters.get(card.id);
    if (bomb !== undefined) parts.push(`💣${bomb}`);
    if (card.lockReq > 0) parts.push(`🔒${card.lockReq}`);
    if (card.unlockedBy.length > 0) parts.push('🔑');
    if (card.paper) parts.push('🧻');
    if (card.piece) parts.push('🧩');
    if (card.zone > 0) parts.push(`🗺️${card.zone + 1}`);
    return parts.join(' ');
  }

  private refreshCard(id: number): void {
    const node = this.nodes.get(id);
    const card = this.level.cards[id];
    if (!node || !card || this.engine.isRemoved(id)) return;
    const free = this.engine.isFree(id);
    const revealed = this.engine.isRevealed(id);

    const variant = !revealed ? 'back' : !free ? 'covered' : this.matchable.has(id) ? 'hint' : 'face';
    node.image.setTexture(cardTexture(this, node.w, node.h, variant));
    node.symbolText.setText(revealed ? this.symbolLines(card.symbols) : '❔');
    node.symbolText.setColor(revealed ? '#2b1f12' : PALETTE.cream);
    node.symbolText.setAlpha(free ? 1 : 0.7);
    node.badgeText.setText(this.badgeOf(card));
    node.root.setAlpha(free ? 1 : 0.88);
  }

  // 튜토리얼 표시 갱신 — 액티브가 바뀔 때마다 후보가 달라지므로 변경분만 다시 그린다
  private refreshMatchable(): void {
    if (!this.tutorial) return;
    const next = new Set(this.engine.getMatchableIds());
    const changed: number[] = [];
    for (const id of next) if (!this.matchable.has(id)) changed.push(id);
    for (const id of this.matchable) if (!next.has(id)) changed.push(id);
    this.matchable = next;
    for (const id of changed) this.refreshCard(id);
  }

  private refreshAllCards(): void {
    for (const c of this.level.cards) this.refreshCard(c.id);
  }

  // ---- 헤더 ----
  private buildHeader(sourceLabel: string): void {
    const bar = this.add
      .image(
        STAGE_W / 2,
        HEADER_H / 2,
        panelTexture(this, 'header-bar', STAGE_W + 40, HEADER_H, {
          top: PALETTE.woodBarTop,
          bottom: PALETTE.woodBarBottom,
          shadow: PALETTE.woodDeep,
          shadowDepth: 5,
          radius: 0,
          grain: true,
          gloss: 0.15,
        }),
      )
      .setDepth(600);

    // 좌상단: 레벨 선택에서 왔으면 목록으로, 아니면 재시작
    const backLabel = this.initData.entry ? '≡' : '⟳';
    this.woodButton(48, HEADER_H / 2, 48, 48, backLabel, 23, () => {
      if (this.initData.entry) this.scene.start('LevelSelect');
      else this.scene.restart();
    }).setDepth(601);

    // SCORE 칩
    this.add
      .image(
        168,
        HEADER_H / 2,
        panelTexture(this, 'chip-score', 150, 54, {
          top: PALETTE.woodChipTop,
          bottom: PALETTE.woodChipBottom,
          shadow: PALETTE.woodChipShadow,
          radius: 10,
          gloss: 0.25,
        }),
      )
      .setDepth(601);
    this.add
      .text(168, HEADER_H / 2 - 13, 'SCORE', { fontFamily: FONT, fontSize: '11px', color: '#3a2408' })
      .setOrigin(0.5)
      .setDepth(602);
    this.scoreText = this.add
      .text(168, HEADER_H / 2 + 9, '0', { fontFamily: FONT, fontSize: '20px', color: '#3a2408', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(602);

    // 콤보 게이지 (cgoal 진행 — ADR-001 O-1: 게이지 도달은 점수 보너스, 아이템 지급 없음)
    if (this.level.cgoal > 0) {
      const gx = 300;
      this.add
        .image(
          gx + 60,
          HEADER_H / 2,
          panelTexture(this, 'chip-gauge', 190, 54, {
            top: PALETTE.woodChipTop,
            bottom: PALETTE.woodChipBottom,
            shadow: PALETTE.woodChipShadow,
            radius: 10,
            gloss: 0.25,
          }),
        )
        .setDepth(601);
      this.add
        .text(gx - 20, HEADER_H / 2 - 14, `×${this.level.cgoal} 콤보 보너스`, {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#3a2408',
        })
        .setOrigin(0, 0.5)
        .setDepth(602);
      this.add.rectangle(gx - 20, HEADER_H / 2 + 10, 110, 9, 0x000000, 0.32).setOrigin(0, 0.5).setDepth(602);
      this.gaugeFill = this.add
        .rectangle(gx - 20, HEADER_H / 2 + 10, 0, 9, 0xf2a52b)
        .setOrigin(0, 0.5)
        .setDepth(603);
      this.gaugeText = this.add
        .text(gx + 100, HEADER_H / 2 + 10, '0/0', { fontFamily: FONT, fontSize: '11px', color: '#3a2408' })
        .setOrigin(0, 0.5)
        .setDepth(603);
    }

    // 🪙 지갑 (시안의 골드 칩)
    this.add
      .image(
        560,
        HEADER_H / 2,
        panelTexture(this, 'chip-gold', 150, 48, {
          top: PALETTE.goldTop,
          bottom: PALETTE.goldBottom,
          shadow: PALETTE.goldShadow,
          radius: 10,
          gloss: 0.55,
        }),
      )
      .setDepth(601);
    this.add.text(505, HEADER_H / 2, '🪙', { fontFamily: FONT, fontSize: '20px' }).setOrigin(0.5).setDepth(602);
    this.goldText = this.add
      .text(528, HEADER_H / 2, '0', {
        fontFamily: FONT,
        fontSize: '19px',
        color: PALETTE.goldText,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(602);

    this.add
      .text(STAGE_W - 24, HEADER_H / 2, sourceLabel, { fontFamily: FONT, fontSize: '13px', color: '#e0c496' })
      .setOrigin(1, 0.5)
      .setDepth(602);

    void bar;
  }

  // ---- 스포트라이트 (액티브 카드) ----
  private buildSpotlight(): void {
    const halo = this.add.image(SPOT.x, SPOT.y, haloTexture(this, 'spot-halo', 340, '30,72,22', 0.72)).setDepth(2);
    const rays = this.add.image(SPOT.x, SPOT.y, raysTexture(this, 'spot-rays', 260)).setDepth(1).setAlpha(0.9);
    this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
    void halo;

    // 카드 뒤 나무 프레임
    this.add
      .image(
        SPOT.x,
        SPOT.y,
        panelTexture(this, 'spot-frame', SPOT_CARD_W + 18, SPOT_CARD_H + 18, {
          top: PALETTE.woodLightTop,
          bottom: PALETTE.woodLightBottom,
          shadow: PALETTE.woodDeep,
          shadowDepth: 6,
          radius: 22,
          grain: true,
        }),
      )
      .setDepth(400);
    this.add
      .image(
        SPOT.x,
        SPOT.y,
        panelTexture(this, 'spot-card', SPOT_CARD_W, SPOT_CARD_H, {
          top: PALETTE.cardTop,
          bottom: PALETTE.cardBottom,
          radius: 14,
          edge: '#ff9a3c',
          edgeWidth: 5,
          glow: { color: 'rgba(242,115,17,0.75)', blur: 26 },
        }),
      )
      .setDepth(401);
    this.spotSymbols = this.add
      .text(SPOT.x, SPOT.y, '', { fontFamily: FONT, fontSize: '38px', color: '#2b1f12', align: 'center' })
      .setOrigin(0.5)
      .setDepth(402);

    // "▼ 같은 그림 찾기 ▼" 배너 (bob)
    const bannerY = SPOT.y - SPOT_CARD_H / 2 - 30;
    this.add
      .image(
        SPOT.x,
        bannerY,
        panelTexture(this, 'banner', 172, 32, {
          top: PALETTE.goldTop,
          bottom: PALETTE.goldBottom,
          shadow: PALETTE.goldShadow,
          shadowDepth: 3,
          radius: 10,
          gloss: 0.55,
        }),
      )
      .setDepth(403);
    const bannerText = this.add
      .text(SPOT.x, bannerY, '▼ 같은 그림 찾기 ▼', {
        fontFamily: FONT,
        fontSize: '15px',
        color: PALETTE.goldText,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(404);
    this.tweens.add({ targets: bannerText, y: bannerY - 7, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // COMBO 뱃지 (콤보 1 이상일 때만 노출)
    this.comboBadge = this.add.container(SPOT.x + 128, SPOT.y - 44).setDepth(410);
    const badgeBg = this.add.image(
      0,
      0,
      panelTexture(this, 'combo-badge', 104, 78, {
        top: PALETTE.orangeTop,
        bottom: PALETTE.orangeBottom,
        shadow: PALETTE.orangeShadow,
        radius: 12,
        edge: 'rgba(255,255,255,0.92)',
        edgeWidth: 3,
        glow: { color: 'rgba(242,115,17,0.7)', blur: 22 },
      }),
    );
    const comboLabel = this.add
      .text(0, -24, 'COMBO', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.comboValue = this.add
      .text(0, 2, '×0', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.comboFlames = this.add.text(0, 26, '🔥', { fontFamily: FONT, fontSize: '18px' }).setOrigin(0.5);
    this.comboBadge.add([badgeBg, comboLabel, this.comboValue, this.comboFlames]);
    this.comboBadge.setVisible(false);
    this.tweens.add({
      targets: this.comboBadge,
      scale: 1.06,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 배너(스포트라이트 상단)와 겹치지 않도록 보드와 스포트라이트 사이 여백에 띄운다
    this.toastText = this.add
      .text(STAGE_W / 2, 500, '', { fontFamily: FONT, fontSize: '21px', color: '#fff0cf', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(900)
      .setAlpha(0);
  }

  // ---- 좌우 콘솔 (덱 · 이동수 · 와일드) ----
  private buildSideConsoles(): void {
    // 덱 박스 (좌하단) — 클릭 = 드로우
    const deck = this.add.container(140, 650).setDepth(500);
    const deckBg = this.add.image(
      0,
      0,
      panelTexture(this, 'deck-box', 104, 132, {
        top: PALETTE.deckTop,
        bottom: PALETTE.deckBottom,
        shadow: PALETTE.deckShadow,
        radius: 12,
        grain: true,
        gloss: 0.2,
      }),
    );
    const deckIcon = this.add.text(0, -22, '↺', { fontFamily: FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);
    this.deckCount = this.add
      .text(0, 26, '0', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const deckLabel = this.add
      .text(0, 52, '드로우', { fontFamily: FONT, fontSize: '12px', color: '#d8ccff' })
      .setOrigin(0.5);
    deck.add([deckBg, deckIcon, this.deckCount, deckLabel]);
    deck.setInteractive(new Phaser.Geom.Rectangle(-52, -66, 104, 132), Phaser.Geom.Rectangle.Contains);
    deck.on('pointerdown', () => this.onDraw());

    // MOVES (이동 제한이 있는 레벨만)
    if (this.level.moveLimit > 0) {
      this.add
        .image(
          1188,
          556,
          panelTexture(this, 'moves-dial', 80, 80, {
            top: PALETTE.goldTop,
            bottom: PALETTE.goldBottom,
            shadow: PALETTE.goldShadow,
            radius: 40,
            gloss: 0.55,
          }),
        )
        .setDepth(500);
      this.movesText = this.add
        .text(1188, 549, '0', { fontFamily: FONT, fontSize: '28px', color: PALETTE.goldText, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(501);
      this.add
        .text(1188, 572, 'MOVES', { fontFamily: FONT, fontSize: '10px', color: PALETTE.goldText })
        .setOrigin(0.5)
        .setDepth(501);
    }

    // 와일드카드 슬롯 (우하단) — 클릭 = 무장 토글
    const wildY = 668;
    this.add
      .text(1188, wildY - 82, '와일드카드', { fontFamily: FONT, fontSize: '12px', color: PALETTE.cream, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(501);
    const wild = this.add.container(1188, wildY).setDepth(500);
    this.wildSlot = this.add.image(0, 0, this.wildSlotTexture(false));
    const wildIcon = this.add.text(0, -6, '🌟', { fontFamily: FONT, fontSize: '44px' }).setOrigin(0.5);
    this.wildCount = this.add
      .text(0, 40, '×0', { fontFamily: FONT, fontSize: '16px', color: PALETTE.goldText, fontStyle: 'bold' })
      .setOrigin(0.5);
    wild.add([this.wildSlot, wildIcon, this.wildCount]);
    wild.setInteractive(new Phaser.Geom.Rectangle(-45, -57, 90, 114), Phaser.Geom.Rectangle.Contains);
    wild.on('pointerdown', () => this.onWildSlot());

    this.wildHint = this.add
      .text(1188, wildY + 66, '', { fontFamily: FONT, fontSize: '12px', color: '#ffd9a0' })
      .setOrigin(0.5)
      .setDepth(501);

    // 🔍 힌트 · 🧲 집게 — 판 안에서 골드로 구매하는 아이템 (마스터 §4.3)
    const items: { key: 'hint' | 'claw'; icon: string; label: string; x: number }[] = [
      { key: 'hint', icon: '🔍', label: '힌트', x: 268 },
      { key: 'claw', icon: '🧲', label: '집게', x: 366 },
    ];
    for (const it of items) {
      const root = this.add.container(it.x, 668).setDepth(500);
      const bg = this.add.image(
        0,
        0,
        panelTexture(this, `item-${it.key}`, 86, 104, {
          top: PALETTE.woodChipTop,
          bottom: PALETTE.woodChipBottom,
          shadow: PALETTE.woodChipShadow,
          shadowDepth: 4,
          radius: 13,
          grain: true,
          gloss: 0.25,
        }),
      );
      const icon = this.add.text(0, -22, it.icon, { fontFamily: FONT, fontSize: '32px' }).setOrigin(0.5);
      const label = this.add
        .text(0, 8, it.label, { fontFamily: FONT, fontSize: '13px', color: '#3a2408', fontStyle: 'bold' })
        .setOrigin(0.5);
      const price = this.add
        .text(0, 32, `🪙${this.eco.itemPrices[it.key]}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#5c4318',
        })
        .setOrigin(0.5);
      root.add([bg, icon, label, price]);
      root.setInteractive(new Phaser.Geom.Rectangle(-43, -52, 86, 104), Phaser.Geom.Rectangle.Contains);
      root.on('pointerdown', () => this.onItem(it.key));
      this.itemButtons.push({ key: it.key, bg, price });
    }
  }

  private wildSlotTexture(armed: boolean): string {
    return panelTexture(this, `wild-slot-${armed ? 'on' : 'off'}`, 90, 114, {
      top: '#fffdf6',
      bottom: '#f0e4cc',
      shadow: PALETTE.woodDeep,
      shadowDepth: 5,
      radius: 14,
      edge: armed ? '#ff9a3c' : '#e0b24a',
      edgeWidth: 3,
      dashed: true,
      glow: { color: armed ? 'rgba(242,115,17,0.8)' : 'rgba(255,213,74,0.55)', blur: armed ? 26 : 18 },
    });
  }

  // ---- HUD 갱신 ----
  private updateHud(): void {
    const s = this.engine.getState();
    this.scoreText.setText(s.score.toLocaleString());
    this.spotSymbols.setText(this.symbolLines(s.active));
    this.deckCount.setText(String(s.deck));
    this.wildCount.setText(`×${s.wild}`);
    this.goldText.setText(this.gold.toLocaleString());
    this.wildSlot.setTexture(this.wildSlotTexture(this.armed === 'wild'));
    this.wildHint.setText(
      this.armed === 'wild' ? '카드를 고르세요' : s.wild <= 0 ? `🪙${this.eco.itemPrices.wild}` : '',
    );
    for (const b of this.itemButtons) {
      const armedThis = b.key === 'claw' && this.armed === 'claw';
      const affordable = this.gold >= this.eco.itemPrices[b.key];
      b.bg.setAlpha(armedThis || affordable ? 1 : 0.45);
      b.price.setText(armedThis ? '취소 · 환불' : `🪙${this.eco.itemPrices[b.key]}`);
    }
    if (this.movesText) this.movesText.setText(String(Math.max(0, this.level.moveLimit - s.moves)));
    this.refreshMatchable();

    if (this.level.cgoal > 0) {
      const progress = s.combo % this.level.cgoal;
      const ratio = this.level.cgoal > 0 ? progress / this.level.cgoal : 0;
      this.gaugeFill.setSize(110 * ratio, 9);
      this.gaugeText.setText(`${progress}/${this.level.cgoal}`);
    }

    if (s.combo > 0) {
      this.comboBadge.setVisible(true);
      this.comboValue.setText(`×${s.combo}`);
      this.comboFlames.setText(s.combo >= 8 ? '🔥🔥🔥' : s.combo >= 4 ? '🔥🔥' : '🔥');
    } else {
      this.comboBadge.setVisible(false);
    }
  }

  // ---- 행동 ----
  private onCardTap(id: number): void {
    if (this.ended) return;
    const mode = this.armed;
    const r =
      mode === 'wild' ? this.engine.useWild(id) : mode === 'claw' ? this.engine.useClaw(id) : this.engine.tryMatch(id);
    if (!r.ok) {
      this.toast(REJECT_MSG[r.reason]);
      this.shake(id);
      // 거부돼도 무장은 유지한다 (잘못 눌렀을 때 다시 고를 수 있게). 와일드 소진만 예외.
      if (r.reason === 'no-wild') this.armed = 'none';
    } else {
      if (mode !== 'claw') this.popSpotlight(); // 집게는 액티브를 바꾸지 않는다
      this.armed = 'none';
    }
    this.updateHud();
    this.checkStuck();
  }

  /** 🔍 힌트 · 🧲 집게 구매 (집게는 무장 후 카드 클릭으로 사용, 재클릭 시 환불) */
  private onItem(key: 'hint' | 'claw'): void {
    if (this.ended) return;
    if (key === 'claw' && this.armed === 'claw') {
      this.gold = earn(this.eco.itemPrices.claw);
      this.armed = 'none';
      this.toast('집게 취소 · 환불');
      this.updateHud();
      return;
    }
    const cost = this.eco.itemPrices[key];
    const res = spend(cost);
    if (!res.ok) {
      this.toast(`골드가 부족합니다 (🪙${cost})`);
      return;
    }
    this.gold = res.gold;
    if (key === 'hint') this.showHint();
    else this.armed = 'claw';
    this.updateHud();
  }

  // 상시 하이라이트는 폐기(D-2) — 유료 힌트에서만 잠깐 짚어 준다
  private showHint(): void {
    const ids = this.engine.getMatchableIds();
    if (ids.length === 0) {
      this.toast('지금 맞출 수 있는 카드가 없어요');
      return;
    }
    const id = ids[Math.floor(Math.random() * ids.length)]!;
    const node = this.nodes.get(id);
    if (!node) return;
    this.toast('🔍 여기예요!');
    node.root.setDepth(node.root.depth + 5000);
    this.tweens.add({
      targets: node.root,
      scale: 1.14,
      duration: 300,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => node.root.setDepth(node.root.depth - 5000),
    });
  }

  private onDraw(): void {
    if (this.ended) return;
    const r = this.engine.draw();
    if (!r.ok) this.toast(REJECT_MSG[r.reason]);
    else this.popSpotlight();
    this.updateHud();
    this.checkStuck();
  }

  /** 🌟 와일드 슬롯 — 보유분이 있으면 무장 토글, 소진됐으면 골드로 구매 (마스터 §4.3) */
  private onWildSlot(): void {
    if (this.ended) return;
    if (this.armed === 'wild') {
      this.armed = 'none';
      this.updateHud();
      return;
    }
    if (this.engine.getState().wild <= 0) {
      const cost = this.eco.itemPrices.wild;
      const res = spend(cost);
      if (!res.ok) {
        this.toast(`골드가 부족합니다 (🪙${cost})`);
        return;
      }
      this.gold = res.gold;
      this.engine.addWild(1);
      this.toast(`🌟 와일드 구매 · 🪙−${cost}`);
    }
    this.armed = 'wild';
    this.updateHud();
  }

  private checkStuck(): void {
    if (this.ended || !this.engine.isStuck()) return;
    // 소프트 실패(D-5): 집게를 살 수 있으면 아직 패배가 아니다 — 탈출 수단을 안내한다
    if (this.gold >= this.eco.itemPrices.claw) {
      this.toast('막혔습니다 — 🧲 집게로 카드를 치울 수 있어요');
      return;
    }
    this.showOverlay('막힘', '유효한 매치·덱·와일드가 없습니다');
  }

  // ---- 엔진 이벤트 ----
  private wireEngineEvents(): void {
    this.engine.events.on('cardRemoved', ({ id }) => {
      const node = this.nodes.get(id);
      if (!node) return;
      this.nodes.delete(id);
      node.root.disableInteractive();
      this.tweens.add({
        targets: node.root,
        alpha: 0,
        scale: 1.22,
        y: node.root.y - 12,
        duration: 170,
        ease: 'Back.easeIn',
        onComplete: () => node.root.destroy(),
      });
    });
    this.engine.events.on('cardUncovered', ({ id }) => {
      this.refreshCard(id);
      const node = this.nodes.get(id);
      if (node) {
        node.root.setScale(0.92);
        this.tweens.add({ targets: node.root, scale: 1, duration: 200, ease: 'Back.easeOut' });
      }
    });
    this.engine.events.on('activeChanged', () => this.updateHud());
    this.engine.events.on('comboChanged', () => this.updateHud());
    this.engine.events.on('scoreChanged', ({ delta }) => {
      this.updateHud();
      if (delta >= 100) this.toast(`콤보 보너스 +${delta}!`);
    });
    this.engine.events.on('deckChanged', () => this.updateHud());
    this.engine.events.on('bombTicked', ({ id, counter }) => {
      this.bombCounters.set(id, counter);
      this.refreshCard(id);
    });
    this.engine.events.on('paperFreed', () => {
      this.toast('종이가 풀렸습니다!');
      this.refreshAllCards();
    });
    this.engine.events.on('gameEnded', ({ result, reason }) => {
      this.showOverlay(result === 'won' ? '승리!' : '패배', END_MSG[reason]);
    });
  }

  // ---- 피드백 ----
  private popSpotlight(): void {
    this.spotSymbols.setScale(0.78);
    this.tweens.add({ targets: this.spotSymbols, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private toast(msg: string): void {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 900, duration: 400 });
  }

  private shake(id: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    const x = node.root.x;
    this.tweens.add({ targets: node.root, x: x + 6, yoyo: true, repeat: 2, duration: 40, onComplete: () => node.root.setX(x) });
  }

  private woodButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    fontSize: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const root = this.add.container(cx, cy);
    const bg = this.add.image(
      0,
      0,
      panelTexture(this, `wood-btn-${w}x${h}`, w, h, {
        top: PALETTE.woodLightTop,
        bottom: PALETTE.woodLightBottom,
        shadow: PALETTE.woodDeep,
        shadowDepth: 3,
        radius: 11,
        grain: true,
        gloss: 0.25,
      }),
    );
    const text = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, color: PALETTE.cream })
      .setOrigin(0.5);
    root.add([bg, text]);
    root.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    root.on('pointerdown', onClick);
    return root;
  }

  private showOverlay(title: string, subtitle: string): void {
    if (this.ended) return;
    this.ended = true;
    const s = this.engine.getState();
    const dim = this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x120c06, 0.78).setDepth(1000);
    const panel = this.add
      .image(
        STAGE_W / 2,
        STAGE_H / 2,
        panelTexture(this, 'result-panel', 540, 330, {
          top: PALETTE.woodBarTop,
          bottom: PALETTE.woodBarBottom,
          shadow: PALETTE.woodDeep,
          shadowDepth: 6,
          radius: 22,
          grain: true,
          gloss: 0.18,
        }),
      )
      .setDepth(1001);
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 - 96, title, {
        fontFamily: FONT,
        fontSize: '56px',
        color: PALETTE.cream,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1002);
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 - 38, subtitle, { fontFamily: FONT, fontSize: '24px', color: '#f0d9ad' })
      .setOrigin(0.5)
      .setDepth(1002);
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 + 6, `SCORE ${s.score.toLocaleString()}`, {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffd76a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1002);

    // 골드 정산 — 패배도 위로보상이 남는다 (마스터 §7 · D-5)
    const gained = payout(this.eco, this.engine.status === 'won', s.score);
    if (!this.settled) {
      this.settled = true;
      this.gold = earn(gained);
      this.goldText.setText(this.gold.toLocaleString());
    }
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 + 44, `🪙 +${gained}   (보유 ${this.gold.toLocaleString()})`, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#f0d9ad',
      })
      .setOrigin(0.5)
      .setDepth(1002);
    void panel;
    void dim;

    // 진행 저장 — 레벨 선택에서 들어온 경우에만 기록한다 (데모·디자이너 해시는 제외)
    const entry = this.initData.entry;
    if (entry) saveResult(entry.id, this.engine.status === 'won', s.score);

    const buttons: { label: string; onClick: () => void }[] = [
      { label: '↻ 다시', onClick: () => this.scene.restart() },
    ];
    if (entry) {
      buttons.push({ label: '≡ 레벨 선택', onClick: () => this.scene.start('LevelSelect') });
      if (this.engine.status === 'won' && entry.id < 12) {
        buttons.push({ label: '다음 ▶', onClick: () => void this.goToLevel(entry.id + 1) });
      }
    }
    const bw = 168;
    const gap = 18;
    const totalW = buttons.length * bw + (buttons.length - 1) * gap;
    buttons.forEach((b, i) => {
      const bx = STAGE_W / 2 - totalW / 2 + bw / 2 + i * (bw + gap);
      this.woodButton(bx, STAGE_H / 2 + 100, bw, 56, b.label, 20, b.onClick).setDepth(1003);
    });
  }

  private async goToLevel(id: number): Promise<void> {
    try {
      const res = await fetch(`levels/index.json`);
      const idx = (await res.json()) as { levels: LevelIndexEntry[] };
      const entry = idx.levels.find((l) => l.id === id);
      if (!entry) return;
      const lv = await (await fetch(`levels/${entry.file}`)).json();
      this.scene.start('Play', { level: lv as LevelData, entry });
    } catch (e) {
      console.warn(`다음 레벨 로드 실패: ${String(e)}`);
      this.scene.start('LevelSelect');
    }
  }
}
