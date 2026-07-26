import Phaser from 'phaser';
import { ComboMatchEngine, type EndReason, type RejectReason } from '../core/engine';
import { LevelLoadError, loadLevel } from '../core/level-loader';
import type { LevelCardData, RuntimeLevel, SymbolId } from '../core/types';
import { computeBoardTransform } from './board-layout';
import { decodeLevelHash, demoLevel } from './level-source';

// 플레이 씬 — 보드 렌더·입력·최소 HUD. 우드 질감·연출 폴리시는 후속(8/3~) 스코프.
// 규칙 상태는 전부 엔진 소유 — 씬은 이벤트 구독 + 행동 호출만 한다.

const STAGE_W = 1280;
const STAGE_H = 760;
const DATA_CW = 64; // 레벨 좌표 공간의 카드 규격 (디자이너 툴 CW/CH)
const DATA_CH = 80;
const BOARD_VIEW = { x: 90, y: 96, width: 1100, height: 452 };

const COLORS = {
  boardPanel: 0x2c2014,
  boardEdge: 0x4a3520,
  cardFace: 0xf3e6c8,
  cardEdge: 0x8a6b45,
  cardCovered: 0x6b5a41,
  cardBack: 0x7a5c37,
  activePanel: 0x3a2a1a,
  activeEdge: 0xc9a061,
  button: 0x5b4226,
  buttonArmed: 0x8a5a2a,
  buttonEdge: 0xc9a061,
  overlay: 0x120c06,
};
const HUD_TEXT = '#e8d9b8';
const CARD_TEXT = '#2b1f12';
const FONT = "'Segoe UI', 'Malgun Gothic', sans-serif";

const REJECT_MSG: Record<RejectReason, string> = {
  'game-over': '게임이 끝났습니다',
  'not-found': '이미 제거된 카드예요',
  covered: '위에 카드가 덮여 있어요',
  'zone-locked': '아직 잠긴 구역이에요',
  'key-locked': '열쇠 카드를 먼저 제거하세요',
  'paper-locked': '조각을 모아야 열려요',
  'combo-locked': '콤보가 더 필요해요',
  'no-shared-symbol': '공유하는 심볼이 없어요',
  'deck-empty': '덱이 비었습니다',
  'no-wild': '와일드가 없습니다',
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
  face: Phaser.GameObjects.Graphics;
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
  private wildArmed = false;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private activeText!: Phaser.GameObjects.Text;
  private drawLabel!: Phaser.GameObjects.Text;
  private wildLabel!: Phaser.GameObjects.Text;
  private wildBg!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private ended = false;

  constructor() {
    super('Play');
  }

  create(): void {
    this.nodes.clear();
    this.bombCounters.clear();
    this.wildArmed = false;
    this.ended = false;

    const { level, sourceLabel } = this.resolveLevel();
    this.level = level;
    this.engine = new ComboMatchEngine(level, {});
    for (const c of level.cards) if (c.bombCounter > 0) this.bombCounters.set(c.id, c.bombCounter);

    this.buildBoard();
    this.buildHud(sourceLabel);
    this.wireEngineEvents();
    this.refreshAllCards();
  }

  private resolveLevel(): { level: RuntimeLevel; sourceLabel: string } {
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

  // ---- 보드 ----
  private buildBoard(): void {
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.boardPanel, 1);
    panel.fillRoundedRect(BOARD_VIEW.x - 24, BOARD_VIEW.y - 24, BOARD_VIEW.width + 48, BOARD_VIEW.height + 48, 18);
    panel.lineStyle(3, COLORS.boardEdge, 1);
    panel.strokeRoundedRect(BOARD_VIEW.x - 24, BOARD_VIEW.y - 24, BOARD_VIEW.width + 48, BOARD_VIEW.height + 48, 18);

    const t = computeBoardTransform(this.level.cards, DATA_CW, DATA_CH, BOARD_VIEW);
    const w = DATA_CW * t.scale;
    const h = DATA_CH * t.scale;

    for (const card of this.level.cards) {
      const cx = t.offsetX + (card.x + DATA_CW / 2) * t.scale;
      const cy = t.offsetY + (card.y + DATA_CH / 2) * t.scale;
      const root = this.add.container(cx, cy);
      root.setDepth(card.layer * 10000 + card.y);

      const face = this.add.graphics();
      const symbolText = this.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: `${Math.round((card.symbols.length <= 2 ? 20 : 14) * t.scale)}px`,
          color: CARD_TEXT,
          align: 'center',
        })
        .setOrigin(0.5);
      const badgeText = this.add
        .text(-w / 2 + 4, -h / 2 + 3, '', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * t.scale)}px`,
          color: CARD_TEXT,
        })
        .setOrigin(0, 0);
      root.add([face, symbolText, badgeText]);

      root.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
      root.on('pointerdown', () => this.onCardTap(card.id));
      this.nodes.set(card.id, { root, face, symbolText, badgeText, w, h });
    }
  }

  private symbolLines(symbols: readonly SymbolId[]): string {
    if (symbols.length <= 3) return symbols.join(' ');
    const lines: string[] = [];
    for (let i = 0; i < symbols.length; i += 2) lines.push(symbols.slice(i, i + 2).join(' '));
    return lines.join('\n');
  }

  private badgeOf(card: LevelCardData): string {
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

    node.face.clear();
    const fill = !revealed ? COLORS.cardBack : free ? COLORS.cardFace : COLORS.cardCovered;
    node.face.fillStyle(fill, 1);
    node.face.fillRoundedRect(-node.w / 2, -node.h / 2, node.w, node.h, 8);
    node.face.lineStyle(2, COLORS.cardEdge, 1);
    node.face.strokeRoundedRect(-node.w / 2, -node.h / 2, node.w, node.h, 8);

    node.symbolText.setText(revealed ? this.symbolLines(card.symbols) : '❔');
    node.symbolText.setAlpha(free ? 1 : 0.65);
    node.badgeText.setText(this.badgeOf(card));
    node.root.setAlpha(free ? 1 : 0.75);
  }

  private refreshAllCards(): void {
    for (const c of this.level.cards) this.refreshCard(c.id);
  }

  // ---- HUD ----
  private buildHud(sourceLabel: string): void {
    const hudStyle = { fontFamily: FONT, fontSize: '26px', color: HUD_TEXT };
    this.scoreText = this.add.text(40, 24, '', hudStyle);
    this.comboText = this.add.text(STAGE_W / 2, 24, '', hudStyle).setOrigin(0.5, 0);
    this.add
      .text(STAGE_W - 40, 30, sourceLabel, { fontFamily: FONT, fontSize: '15px', color: '#9a8a6a' })
      .setOrigin(1, 0);

    // 액티브 카드 패널 (하단 중앙)
    const activePanel = this.add.graphics();
    activePanel.fillStyle(COLORS.activePanel, 1);
    activePanel.fillRoundedRect(STAGE_W / 2 - 130, 588, 260, 140, 14);
    activePanel.lineStyle(3, COLORS.activeEdge, 1);
    activePanel.strokeRoundedRect(STAGE_W / 2 - 130, 588, 260, 140, 14);
    this.add
      .text(STAGE_W / 2, 602, '액티브 카드', { fontFamily: FONT, fontSize: '14px', color: '#c9a061' })
      .setOrigin(0.5, 0);
    this.activeText = this.add
      .text(STAGE_W / 2, 672, '', { fontFamily: FONT, fontSize: '44px', color: HUD_TEXT })
      .setOrigin(0.5);

    // 드로우 버튼 (덱 잔량 포함)
    const drawBtn = this.makeButton(STAGE_W - 160, 658, 200, 72, () => this.onDraw());
    this.drawLabel = drawBtn.label;

    // 와일드 무장 토글
    const wildBtn = this.makeButton(STAGE_W - 400, 658, 200, 72, () => this.toggleWild());
    this.wildLabel = wildBtn.label;
    this.wildBg = wildBtn.bg;

    // 다시 시작
    const retry = this.makeButton(160, 658, 200, 72, () => this.scene.restart());
    retry.label.setText('↻ 다시 시작');

    this.toastText = this.add
      .text(STAGE_W / 2, 560, '', { fontFamily: FONT, fontSize: '20px', color: '#ffd9a0' })
      .setOrigin(0.5)
      .setDepth(90000)
      .setAlpha(0);

    this.updateHud();
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    onClick: () => void,
  ): { bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text } {
    const root = this.add.container(cx, cy);
    const bg = this.add.graphics();
    this.drawButtonBg(bg, w, h, COLORS.button);
    const label = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: HUD_TEXT })
      .setOrigin(0.5);
    root.add([bg, label]);
    root.setSize(w, h);
    root.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    root.on('pointerdown', onClick);
    return { bg, label };
  }

  private drawButtonBg(bg: Phaser.GameObjects.Graphics, w: number, h: number, fill: number): void {
    bg.clear();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, COLORS.buttonEdge, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  }

  private updateHud(): void {
    const s = this.engine.getState();
    this.scoreText.setText(`점수 ${s.score}`);
    const gauge = this.level.cgoal > 0 ? ` · 게이지 ${s.combo % this.level.cgoal}/${this.level.cgoal}` : '';
    this.comboText.setText(`콤보 ×${s.combo}${gauge}`);
    this.activeText.setText(s.active.join('  '));
    this.drawLabel.setText(`드로우 ×${s.deck}`);
    this.wildLabel.setText(`${this.wildArmed ? '🃏 카드 선택…' : '🃏 와일드'} ×${s.wild}`);
    this.drawButtonBg(this.wildBg, 200, 72, this.wildArmed ? COLORS.buttonArmed : COLORS.button);
  }

  // ---- 행동 ----
  private onCardTap(id: number): void {
    if (this.ended) return;
    const r = this.wildArmed ? this.engine.useWild(id) : this.engine.tryMatch(id);
    if (!r.ok) {
      this.toast(REJECT_MSG[r.reason]);
      this.shake(id);
      if (this.wildArmed && r.reason === 'no-wild') this.wildArmed = false;
    } else if (this.wildArmed) {
      this.wildArmed = false;
    }
    this.updateHud();
    this.checkStuck();
  }

  private onDraw(): void {
    if (this.ended) return;
    const r = this.engine.draw();
    if (!r.ok) this.toast(REJECT_MSG[r.reason]);
    this.updateHud();
    this.checkStuck();
  }

  private toggleWild(): void {
    if (this.ended) return;
    if (this.engine.getState().wild <= 0) {
      this.toast(REJECT_MSG['no-wild']);
      return;
    }
    this.wildArmed = !this.wildArmed;
    this.updateHud();
  }

  private checkStuck(): void {
    if (!this.ended && this.engine.isStuck()) {
      // 소프트 실패(D-5) 세션 계층은 후속 스코프 — 지금은 재시작 안내만
      this.showOverlay('막힘', '유효한 매치·덱·와일드가 없습니다');
    }
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
        scale: 1.18,
        duration: 140,
        onComplete: () => node.root.destroy(),
      });
    });
    this.engine.events.on('cardUncovered', ({ id }) => this.refreshCard(id));
    this.engine.events.on('activeChanged', () => this.updateHud());
    this.engine.events.on('comboChanged', () => this.updateHud());
    this.engine.events.on('scoreChanged', () => this.updateHud());
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
  private toast(msg: string): void {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 900, duration: 400 });
  }

  private shake(id: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    const x = node.root.x;
    this.tweens.add({ targets: node.root, x: x + 6, yoyo: true, repeat: 2, duration: 40 });
  }

  private showOverlay(title: string, subtitle: string): void {
    if (this.ended) return;
    this.ended = true;
    const dim = this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, COLORS.overlay, 0.72);
    dim.setDepth(100000);
    const s = this.engine.getState();
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 - 60, title, { fontFamily: FONT, fontSize: '64px', color: HUD_TEXT })
      .setOrigin(0.5)
      .setDepth(100001);
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 + 12, `${subtitle} · 점수 ${s.score}`, {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#c9a061',
      })
      .setOrigin(0.5)
      .setDepth(100001);
    this.add
      .text(STAGE_W / 2, STAGE_H / 2 + 76, '클릭하면 다시 시작합니다', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#9a8a6a',
      })
      .setOrigin(0.5)
      .setDepth(100001);
    dim.setInteractive();
    dim.once('pointerdown', () => this.scene.restart());
  }
}
