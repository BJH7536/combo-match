import Phaser from 'phaser';
import type { LevelData } from '../core/types';
import { loadProgress, type Progress } from './progress';
import { feltTexture, PALETTE, panelTexture } from './skin';
import { loadGold } from './wallet';

// 레벨 선택 — public/levels/index.json을 읽어 레벨 카드를 깔고, 진행 상황(클리어·최고점)을 표시한다.
// 심사 편의를 위해 잠금은 두지 않는다 (아무 레벨이나 바로 볼 수 있어야 장치 7종이 노출된다).

const STAGE_W = 1280;
const STAGE_H = 760;
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

  constructor() {
    super('LevelSelect');
  }

  create(): void {
    this.progress = loadProgress();
    this.add.image(STAGE_W / 2, STAGE_H / 2, feltTexture(this, 'felt', STAGE_W, STAGE_H));

    this.add
      .image(
        STAGE_W / 2,
        54,
        panelTexture(this, 'select-header', STAGE_W + 40, 92, {
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
      .text(STAGE_W / 2, 40, '콤보 매칭', {
        fontFamily: FONT,
        fontSize: '34px',
        color: PALETTE.cream,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(STAGE_W / 2, 72, '같은 그림을 찾아 이어가세요 — 레벨을 고르면 시작합니다', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#d8bd92',
      })
      .setOrigin(0.5)
      .setDepth(11);

    // 🪙 지갑 — 아이템 구매 재원 (마스터 §7)
    this.add
      .image(
        STAGE_W - 110,
        54,
        panelTexture(this, 'select-gold', 160, 48, {
          top: PALETTE.goldTop,
          bottom: PALETTE.goldBottom,
          shadow: PALETTE.goldShadow,
          radius: 10,
          gloss: 0.55,
        }),
      )
      .setDepth(11);
    this.add.text(STAGE_W - 168, 54, '🪙', { fontFamily: FONT, fontSize: '21px' }).setOrigin(0.5).setDepth(12);
    this.add
      .text(STAGE_W - 145, 54, loadGold().toLocaleString(), {
        fontFamily: FONT,
        fontSize: '20px',
        color: PALETTE.goldText,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(12);

    const status = this.add
      .text(STAGE_W / 2, STAGE_H / 2, '레벨 목록을 불러오는 중…', {
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
    const cols = 4;
    const cw = 250;
    const ch = 150;
    const gapX = 32;
    const gapY = 28;
    const rows = Math.ceil(levels.length / cols);
    const totalW = cols * cw + (cols - 1) * gapX;
    const totalH = rows * ch + (rows - 1) * gapY;
    const x0 = (STAGE_W - totalW) / 2 + cw / 2;
    const y0 = 120 + (STAGE_H - 140 - totalH) / 2 + ch / 2;

    levels.forEach((lv, i) => {
      const cx = x0 + (i % cols) * (cw + gapX);
      const cy = y0 + Math.floor(i / cols) * (ch + gapY);
      const rec = this.progress[String(lv.id)];
      const cleared = rec?.cleared === true;

      const root = this.add.container(cx, cy);
      const bg = this.add.image(
        0,
        0,
        panelTexture(this, `lvcard-${cleared ? 'done' : 'todo'}`, cw, ch, {
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
        .text(-cw / 2 + 18, -ch / 2 + 14, String(lv.id), {
          fontFamily: FONT,
          fontSize: '30px',
          color: '#3a2408',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0);
      const name = this.add
        .text(cw / 2 - 18, -ch / 2 + 22, lv.name, {
          fontFamily: FONT,
          fontSize: '19px',
          color: '#3a2408',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
      const tier = this.add
        .text(-cw / 2 + 18, -ch / 2 + 52, `${lv.tier} · 카드 ${lv.cards}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#5c4318',
        })
        .setOrigin(0, 0);
      const icons = this.add
        .text(-cw / 2 + 18, 18, lv.devices.map((d) => DEVICE_ICON[d] ?? '').join(' '), {
          fontFamily: FONT,
          fontSize: '22px',
        })
        .setOrigin(0, 0);
      const badge = this.add
        .text(cw / 2 - 18, ch / 2 - 16, cleared ? `✔ ${rec!.bestScore.toLocaleString()}` : '▶ 플레이', {
          fontFamily: FONT,
          fontSize: '16px',
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
