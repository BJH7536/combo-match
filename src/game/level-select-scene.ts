import Phaser from 'phaser';
import type { LevelData } from '../core/types';
import { showHelpOverlay } from './help-overlay';
import { computeLayout, type Layout } from './layout';
import { loadProgress, type Progress } from './progress';
import { feltTexture, PALETTE, panelTexture } from './skin';
import { loadGold } from './wallet';

// 레벨 선택 — public/levels/index.json을 읽어 레벨 카드를 깔고, 진행 상황(클리어·최고점)을 표시한다.
// 심사 편의를 위해 잠금은 두지 않는다 (아무 레벨이나 바로 볼 수 있어야 장치 7종이 노출된다).

const FONT = "'Segoe UI', 'Malgun Gothic', sans-serif";

const DEVICE_ICON: Record<string, string> = {
  key: '🔑',
  bomb: '💣',
  zone: '🗺️',
  collect: '🎯',
  paper: '🧻',
  lock: '🔒',
  facedown: '❔',
  r2: '②',
};

export interface LevelIndexEntry {
  id: number;
  name: string;
  file: string;
  difficulty: number;
  tier: string;
  devices: string[];
  cards: number;
}

export class LevelSelectScene extends Phaser.Scene {
  private progress: Progress = {};
  private L!: Layout;

  constructor() {
    super('LevelSelect');
  }

  create(): void {
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.progress = loadProgress();
    this.add.image(this.L.W / 2, this.L.H / 2, feltTexture(this, 'felt', this.L.W, this.L.H));

    this.add
      .image(
        this.L.W / 2,
        this.L.headerH * 0.62,
        panelTexture(this, 'select-header', this.L.W + 40, Math.round(this.L.headerH * 1.24), {
          top: PALETTE.woodBarTop,
          bottom: PALETTE.woodBarBottom,
          shadow: PALETTE.woodDeep,
          shadowDepth: 5,
          radius: 0,
          grain: true,
          gloss: 0.15,
        }),
      )
      .setDepth(10);
    this.add
      .text(this.L.W / 2, this.L.headerH * 0.44, '콤보 매칭', {
        fontFamily: FONT,
        fontSize: this.L.portrait ? '26px' : '34px',
        color: PALETTE.cream,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(this.L.W / 2, this.L.headerH * 0.9, '같은 그림을 찾아 이어가세요 — 레벨을 고르면 시작합니다', {
        fontFamily: FONT,
        fontSize: this.L.portrait ? '11px' : '14px',
        color: '#d8bd92',
      })
      .setOrigin(0.5)
      .setDepth(11);

    // 🪙 지갑 — 아이템 구매 재원 (마스터 §7)
    const chipY = this.L.portrait ? this.L.headerH * 1.55 : this.L.headerH * 0.62;
    this.add
      .image(
        this.L.W - (this.L.portrait ? 90 : 110),
        chipY,
        panelTexture(this, 'select-gold', this.L.portrait ? 140 : 160, 48, {
          top: PALETTE.goldTop,
          bottom: PALETTE.goldBottom,
          shadow: PALETTE.goldShadow,
          radius: 10,
          gloss: 0.55,
        }),
      )
      .setDepth(11);
    this.add
      .text(this.L.W - (this.L.portrait ? 143 : 168), chipY, '🪙', { fontFamily: FONT, fontSize: '21px' })
      .setOrigin(0.5)
      .setDepth(12);
    this.add
      .text(this.L.W - (this.L.portrait ? 122 : 145), chipY, loadGold().toLocaleString(), {
        fontFamily: FONT,
        fontSize: '20px',
        color: PALETTE.goldText,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(12);

    // ❓ 규칙 — 언제든 다시 볼 수 있게
    const hw = 130;
    const hh = 44;
    const help = this.add.container(this.L.portrait ? 82 : 120, chipY).setDepth(12);
    help.add([
      this.add.image(
        0,
        0,
        panelTexture(this, 'help-btn', hw, hh, {
          top: PALETTE.woodLightTop,
          bottom: PALETTE.woodLightBottom,
          shadow: PALETTE.woodDeep,
          shadowDepth: 3,
          radius: 11,
          grain: true,
          gloss: 0.25,
        }),
      ),
      this.add
        .text(0, 0, '❓ 규칙', { fontFamily: FONT, fontSize: '18px', color: PALETTE.cream, fontStyle: 'bold' })
        .setOrigin(0.5),
    ]);
    help.setInteractive(new Phaser.Geom.Rectangle(-hw / 2, -hh / 2, hw, hh), Phaser.Geom.Rectangle.Contains);
    help.on('pointerdown', () => showHelpOverlay(this));

    const status = this.add
      .text(this.L.W / 2, this.L.H / 2, '레벨 목록을 불러오는 중…', {
        fontFamily: FONT,
        fontSize: '22px',
        color: PALETTE.cream,
      })
      .setOrigin(0.5);

    void this.loadIndex()
      .then((levels) => {
        status.destroy();
        this.buildGrid(levels);
      })
      .catch((e: unknown) => {
        status.setText(`레벨 목록을 불러오지 못했습니다\n${String(e)}`).setAlign('center');
      });
  }

  private async loadIndex(): Promise<LevelIndexEntry[]> {
    const res = await fetch('levels/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { levels: LevelIndexEntry[] };
    return data.levels;
  }

  private buildGrid(levels: LevelIndexEntry[]): void {
    const cols = this.L.selectCols;
    const rows = Math.ceil(levels.length / cols);
    const gapX = Math.round(this.L.W * 0.026);
    const gapY = Math.round(this.L.H * 0.022);
    const top = Math.round(this.L.portrait ? this.L.headerH * 2.1 : this.L.headerH * 1.5);
    const availW = this.L.W * 0.94;
    const availH = this.L.H - top - Math.round(this.L.H * 0.03);
    const cw = Math.floor((availW - (cols - 1) * gapX) / cols);
    const ch = Math.floor(Math.min(cw * (this.L.portrait ? 0.68 : 0.6), (availH - (rows - 1) * gapY) / rows));
    const totalW = cols * cw + (cols - 1) * gapX;
    const totalH = rows * ch + (rows - 1) * gapY;
    const x0 = (this.L.W - totalW) / 2 + cw / 2;
    const y0 = top + (availH - totalH) / 2 + ch / 2;
    const fs = (r: number): string => `${Math.max(9, Math.round(ch * r))}px`;

    levels.forEach((lv, i) => {
      const cx = x0 + (i % cols) * (cw + gapX);
      const cy = y0 + Math.floor(i / cols) * (ch + gapY);
      const rec = this.progress[String(lv.id)];
      const cleared = rec?.cleared === true;

      const root = this.add.container(cx, cy);
      const bg = this.add.image(
        0,
        0,
        panelTexture(this, `lvcard-${cleared ? 'done' : 'todo'}-${cw}x${ch}`, cw, ch, {
          top: cleared ? '#d8b26a' : PALETTE.woodChipTop,
          bottom: cleared ? '#ab8038' : PALETTE.woodChipBottom,
          shadow: cleared ? PALETTE.goldShadow : PALETTE.woodChipShadow,
          shadowDepth: 5,
          radius: 16,
          grain: true,
          gloss: 0.25,
        }),
      );
      const num = this.add
        .text(-cw / 2 + ch * 0.12, -ch / 2 + ch * 0.09, String(lv.id), {
          fontFamily: FONT,
          fontSize: fs(0.2),
          color: '#3a2408',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0);
      const name = this.add
        .text(cw / 2 - ch * 0.12, -ch / 2 + ch * 0.14, lv.name, {
          fontFamily: FONT,
          fontSize: fs(0.13),
          color: '#3a2408',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
      const tier = this.add
        .text(-cw / 2 + ch * 0.12, -ch / 2 + ch * 0.35, `${lv.tier} · 카드 ${lv.cards}`, {
          fontFamily: FONT,
          fontSize: fs(0.088),
          color: '#5c4318',
        })
        .setOrigin(0, 0);
      const icons = this.add
        .text(-cw / 2 + ch * 0.12, ch * 0.1, lv.devices.map((d) => DEVICE_ICON[d] ?? '').join(' '), {
          fontFamily: FONT,
          fontSize: fs(0.15),
        })
        .setOrigin(0, 0);
      const badge = this.add
        .text(cw / 2 - ch * 0.1, ch / 2 - ch * 0.09, cleared ? `✔ ${rec!.bestScore.toLocaleString()}` : '▶ 플레이', {
          fontFamily: FONT,
          fontSize: fs(0.105),
          color: cleared ? '#1f4a12' : '#402c0c',
          fontStyle: 'bold',
        })
        .setOrigin(1, 1);
      root.add([bg, num, name, tier, icons, badge]);

      root.setInteractive(new Phaser.Geom.Rectangle(-cw / 2, -ch / 2, cw, ch), Phaser.Geom.Rectangle.Contains);
      root.on('pointerover', () => root.setScale(1.03));
      root.on('pointerout', () => root.setScale(1));
      root.on('pointerdown', () => {
        void this.startLevel(lv);
      });
    });
  }

  private async startLevel(entry: LevelIndexEntry): Promise<void> {
    try {
      const res = await fetch(`levels/${entry.file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const level = (await res.json()) as LevelData;
      this.scene.start('Play', { level, entry });
    } catch (e) {
      console.warn(`레벨 로드 실패: ${String(e)}`);
    }
  }
}
