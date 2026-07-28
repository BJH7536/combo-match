import Phaser from 'phaser';
import type { LevelData } from '../core/types';
import { showHelpOverlay } from './help-overlay';
import { computeLayout, type Layout } from './layout';
import { loadProgress, type Progress } from './progress';
import { feltTexture, PALETTE, panelTexture } from './skin';
import { loadGold } from './wallet';
import { sfx } from './audio';

// 레벨 선택 — public/levels/index.json을 읽어 스테이지(10개) → 레벨(스테이지당 10개) 2단으로 고른다.
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

const TOPO_ICON: Record<string, string> = {
  grid: '▦',
  stack: '🂠',
  pyramid: '🔺',
  tripeaks: '⛰️',
  wave: '🌊',
  towers: '🏛️',
  diamond: '🔶',
  composite: '🧬',
};

export interface LevelIndexEntry {
  id: number;
  name: string;
  file: string;
  stage: number;
  topology: string;
  difficulty: number;
  tier: string;
  devices: string[];
  cards: number;
}

export interface StageEntry {
  id: number;
  name: string;
  from: number;
  to: number;
}

export class LevelSelectScene extends Phaser.Scene {
  private progress: Progress = {};
  private L!: Layout;
  private levels: LevelIndexEntry[] = [];
  private stages: StageEntry[] = [];
  private view?: Phaser.GameObjects.Container; // 스테이지/레벨 그리드 (전환 시 통째로 파괴)
  private openStage: number | null = null; // 씬 재진입 시 보던 스테이지 복원

  constructor() {
    super('LevelSelect');
  }

  private fs(px: number): string {
    return `${Math.max(9, Math.round(px * this.L.ui))}px`;
  }

  create(data?: { stage?: number }): void {
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.progress = loadProgress();
    if (data?.stage) this.openStage = data.stage;
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
        fontSize: this.fs(this.L.portrait ? 26 : 34),
        color: PALETTE.cream,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(this.L.W / 2, this.L.headerH * 0.9, '같은 그림을 찾아 이어가세요 — 스테이지를 고르면 시작합니다', {
        fontFamily: FONT,
        fontSize: this.fs(this.L.portrait ? 11 : 14),
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
      .text(this.L.W - (this.L.portrait ? 143 : 168), chipY, '🪙', { fontFamily: FONT, fontSize: this.fs(21) })
      .setOrigin(0.5)
      .setDepth(12);
    this.add
      .text(this.L.W - (this.L.portrait ? 122 : 145), chipY, loadGold().toLocaleString(), {
        fontFamily: FONT,
        fontSize: this.fs(20),
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
        .text(0, 0, '❓ 규칙', { fontFamily: FONT, fontSize: this.fs(18), color: PALETTE.cream, fontStyle: 'bold' })
        .setOrigin(0.5),
    ]);
    help.setInteractive(new Phaser.Geom.Rectangle(-hw / 2, -hh / 2, hw, hh), Phaser.Geom.Rectangle.Contains);
    help.on('pointerdown', () => {
      sfx.tap();
      showHelpOverlay(this);
    });

    const status = this.add
      .text(this.L.W / 2, this.L.H / 2, '레벨 목록을 불러오는 중…', {
        fontFamily: FONT,
        fontSize: this.fs(22),
        color: PALETTE.cream,
      })
      .setOrigin(0.5);

    void this.loadIndex()
      .then(() => {
        status.destroy();
        if (this.openStage) this.buildLevelGrid(this.openStage);
        else this.buildStageGrid();
      })
      .catch((e: unknown) => {
        status.setText(`레벨 목록을 불러오지 못했습니다\n${String(e)}`).setAlign('center');
      });
  }

  private async loadIndex(): Promise<void> {
    const res = await fetch('levels/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { stages?: StageEntry[]; levels: LevelIndexEntry[] };
    this.levels = data.levels;
    // 구버전 인덱스(스테이지 없음)와도 호환 — 10개 단위로 묶는다
    this.stages =
      data.stages ??
      Array.from({ length: Math.ceil(data.levels.length / 10) }, (_, i) => ({
        id: i + 1,
        name: `스테이지 ${i + 1}`,
        from: i * 10 + 1,
        to: Math.min(data.levels.length, i * 10 + 10),
      }));
  }

  /** count개 카드의 그리드 좌표·크기를 계산한다 (스테이지·레벨 그리드 공용) */
  private gridSpec(count: number): { cx: (i: number) => number; cy: (i: number) => number; cw: number; ch: number } {
    const cols = this.L.selectCols;
    const rows = Math.ceil(count / cols);
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
    return {
      cx: (i) => x0 + (i % cols) * (cw + gapX),
      cy: (i) => y0 + Math.floor(i / cols) * (ch + gapY),
      cw,
      ch,
    };
  }

  private resetView(): Phaser.GameObjects.Container {
    this.view?.destroy(true);
    this.view = this.add.container(0, 0);
    return this.view;
  }

  /** 카드 공통 프레임 + 호버·클릭 배선 */
  private cardFrame(
    view: Phaser.GameObjects.Container,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    done: boolean,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const root = this.add.container(cx, cy);
    root.add(
      this.add.image(
        0,
        0,
        panelTexture(this, `lvcard-${done ? 'done' : 'todo'}-${cw}x${ch}`, cw, ch, {
          top: done ? '#d8b26a' : PALETTE.woodChipTop,
          bottom: done ? '#ab8038' : PALETTE.woodChipBottom,
          shadow: done ? PALETTE.goldShadow : PALETTE.woodChipShadow,
          shadowDepth: 5,
          radius: 16,
          grain: true,
          gloss: 0.25,
        }),
      ),
    );
    root.setInteractive(new Phaser.Geom.Rectangle(-cw / 2, -ch / 2, cw, ch), Phaser.Geom.Rectangle.Contains);
    root.on('pointerover', () => root.setScale(1.03));
    root.on('pointerout', () => root.setScale(1));
    root.on('pointerdown', () => {
      sfx.tap();
      onTap();
    });
    view.add(root);
    return root;
  }

  // ---- 1단: 스테이지 선택 ----
  private buildStageGrid(): void {
    this.openStage = null;
    const view = this.resetView();
    const g = this.gridSpec(this.stages.length);
    const fs = (r: number): string => `${Math.max(9, Math.round(g.ch * r))}px`;

    this.stages.forEach((st, i) => {
      const lvs = this.levels.filter((l) => l.stage === st.id);
      const clearedN = lvs.filter((l) => this.progress[String(l.id)]?.cleared === true).length;
      const allDone = clearedN === lvs.length && lvs.length > 0;
      const tiers = `${lvs[0]?.tier ?? ''}~${lvs[lvs.length - 1]?.tier ?? ''}`;
      const icons = [...new Set(lvs.flatMap((l) => l.devices))].slice(0, 5).map((d) => DEVICE_ICON[d] ?? '');

      const root = this.cardFrame(view, g.cx(i), g.cy(i), g.cw, g.ch, allDone, () => {
        this.buildLevelGrid(st.id);
      });
      root.add([
        this.add
          .text(-g.cw / 2 + g.ch * 0.12, -g.ch / 2 + g.ch * 0.09, `STAGE ${st.id}`, {
            fontFamily: FONT,
            fontSize: fs(0.17),
            color: '#3a2408',
            fontStyle: 'bold',
          })
          .setOrigin(0, 0),
        this.add
          .text(g.cw / 2 - g.ch * 0.12, -g.ch / 2 + g.ch * 0.14, st.name, {
            fontFamily: FONT,
            fontSize: fs(0.14),
            color: '#3a2408',
            fontStyle: 'bold',
          })
          .setOrigin(1, 0),
        this.add
          .text(-g.cw / 2 + g.ch * 0.12, -g.ch / 2 + g.ch * 0.36, `레벨 ${st.from}–${st.to} · ${tiers}`, {
            fontFamily: FONT,
            fontSize: fs(0.088),
            color: '#5c4318',
          })
          .setOrigin(0, 0),
        this.add
          .text(-g.cw / 2 + g.ch * 0.12, g.ch * 0.1, icons.join(' '), { fontFamily: FONT, fontSize: fs(0.14) })
          .setOrigin(0, 0),
        this.add
          .text(g.cw / 2 - g.ch * 0.1, g.ch / 2 - g.ch * 0.09, allDone ? '★ 완료' : `✔ ${clearedN}/${lvs.length}`, {
            fontFamily: FONT,
            fontSize: fs(0.105),
            color: allDone ? '#1f4a12' : '#402c0c',
            fontStyle: 'bold',
          })
          .setOrigin(1, 1),
      ]);
    });
  }

  // ---- 2단: 스테이지 안의 레벨 선택 ----
  private buildLevelGrid(stageId: number): void {
    this.openStage = stageId;
    const view = this.resetView();
    const st = this.stages.find((s) => s.id === stageId);
    const lvs = this.levels.filter((l) => l.stage === stageId);
    const g = this.gridSpec(lvs.length);
    const fs = (r: number): string => `${Math.max(9, Math.round(g.ch * r))}px`;

    // ← 스테이지 목록으로
    const bw = 170;
    const bh = 42;
    const backY = Math.round(this.L.portrait ? this.L.headerH * 1.95 : this.L.headerH * 1.38); // 헤더 바(≈1.24×headerH) 아래로
    const back = this.add.container(this.L.portrait ? 100 : 118, backY);
    back.add([
      this.add.image(0, 0, panelTexture(this, 'stage-back', bw, bh, {
        top: PALETTE.woodLightTop,
        bottom: PALETTE.woodLightBottom,
        shadow: PALETTE.woodDeep,
        shadowDepth: 3,
        radius: 10,
        grain: true,
        gloss: 0.25,
      })),
      this.add
        .text(0, 0, '← 스테이지 목록', { fontFamily: FONT, fontSize: this.fs(15), color: PALETTE.cream, fontStyle: 'bold' })
        .setOrigin(0.5),
    ]);
    back.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
    back.on('pointerdown', () => {
      sfx.tap();
      this.buildStageGrid();
    });
    view.add(back);
    if (st) {
      view.add(
        this.add
          .text(this.L.W / 2, backY, `STAGE ${st.id} · ${st.name}`, {
            fontFamily: FONT,
            fontSize: this.fs(18),
            color: PALETTE.cream,
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );
    }

    lvs.forEach((lv, i) => {
      const rec = this.progress[String(lv.id)];
      const cleared = rec?.cleared === true;
      const root = this.cardFrame(view, g.cx(i), g.cy(i), g.cw, g.ch, cleared, () => {
        void this.startLevel(lv);
      });
      root.add([
        this.add
          .text(-g.cw / 2 + g.ch * 0.12, -g.ch / 2 + g.ch * 0.09, String(lv.id), {
            fontFamily: FONT,
            fontSize: fs(0.2),
            color: '#3a2408',
            fontStyle: 'bold',
          })
          .setOrigin(0, 0),
        this.add
          .text(g.cw / 2 - g.ch * 0.12, -g.ch / 2 + g.ch * 0.14, `${TOPO_ICON[lv.topology] ?? ''} ${lv.name}`, {
            fontFamily: FONT,
            fontSize: fs(0.13),
            color: '#3a2408',
            fontStyle: 'bold',
          })
          .setOrigin(1, 0),
        this.add
          .text(-g.cw / 2 + g.ch * 0.12, -g.ch / 2 + g.ch * 0.35, `${lv.tier} · 카드 ${lv.cards}`, {
            fontFamily: FONT,
            fontSize: fs(0.088),
            color: '#5c4318',
          })
          .setOrigin(0, 0),
        this.add
          .text(-g.cw / 2 + g.ch * 0.12, g.ch * 0.1, lv.devices.map((d) => DEVICE_ICON[d] ?? '').join(' '), {
            fontFamily: FONT,
            fontSize: fs(0.15),
          })
          .setOrigin(0, 0),
        this.add
          .text(g.cw / 2 - g.ch * 0.1, g.ch / 2 - g.ch * 0.09, cleared ? `✔ ${rec!.bestScore.toLocaleString()}` : '▶ 플레이', {
            fontFamily: FONT,
            fontSize: fs(0.105),
            color: cleared ? '#1f4a12' : '#402c0c',
            fontStyle: 'bold',
          })
          .setOrigin(1, 1),
      ]);
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
