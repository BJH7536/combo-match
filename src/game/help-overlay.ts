import Phaser from 'phaser';
import { computeLayout } from './layout';
import { PALETTE, panelTexture } from './skin';

// 규칙 안내 — 심사자가 링크를 처음 열었을 때 매칭 규칙을 모른 채 헤매지 않도록.
// 첫 플레이에서 1회 자동 표시하고, 이후에는 레벨 선택의 "규칙" 버튼으로 언제든 다시 본다.

const FONT = "'Segoe UI', 'Malgun Gothic', sans-serif";
const SEEN_KEY = 'combo-match:seen-help';

const RULES: string[] = [
  '① 화면 아래 빛나는 카드가 「액티브 카드」입니다.',
  '② 액티브 카드와 같은 그림이 하나라도 있는 보드 카드를 고르세요.',
  '③ 고른 카드가 새 액티브가 되고 콤보가 １씩 올라갑니다.',
  '④ 막히면 ↺ 드로우로 액티브를 바꾸거나 아이템을 쓰세요.',
  '⑤ 보드를 모두 비우면 승리! (레벨 1~3은 고를 수 있는 카드를 초록으로 알려줍니다)',
];

const DEVICES = '🔒 콤보 잠금   🔑 열쇠   💣 폭탄   🗺️ 구역   🧻 종이   ❔ 뒤집힘';
const ITEMS = '🔍 힌트 120   🧲 집게 350   🌟 와일드 500';

export function hasSeenHelp(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // 저장소를 못 쓰면 매번 띄우지 않는다
  }
}

export function markHelpSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 무시 */
  }
}

/** 규칙 오버레이를 띄운다. 닫으면 onClose 호출 */
export function showHelpOverlay(scene: Phaser.Scene, onClose?: () => void): void {
  const L = computeLayout(scene.scale.width, scene.scale.height);
  const STAGE_W = L.W;
  const STAGE_H = L.H;
  // 좁은 화면에서도 패널이 넘치지 않게 크기와 글자를 함께 줄인다
  const pw = Math.round(Math.min(860, STAGE_W * 0.94));
  const ph = Math.round(Math.min(470, STAGE_H * 0.66));
  const sc = Math.min(1, pw / 860);
  const fs = (base: number): string => `${Math.max(11, Math.round(base * sc))}px`;
  const D = 20000; // 다른 UI보다 항상 위
  const parts: Phaser.GameObjects.GameObject[] = [];

  const dim = scene.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x120c06, 0.82).setDepth(D);
  dim.setInteractive(); // 뒤쪽 클릭 차단
  parts.push(dim);

  parts.push(
    scene.add
      .image(
        STAGE_W / 2,
        STAGE_H / 2,
        panelTexture(scene, 'help-panel', pw, ph, {
          top: PALETTE.woodBarTop,
          bottom: PALETTE.woodBarBottom,
          shadow: PALETTE.woodDeep,
          shadowDepth: 6,
          radius: 22,
          grain: true,
          gloss: 0.18,
        }),
      )
      .setDepth(D + 1),
  );

  const top = STAGE_H / 2 - ph / 2 + Math.round(28 * sc);
  parts.push(
    scene.add
      .text(STAGE_W / 2, top, '같은 그림 찾기 — 이렇게 플레이합니다', {
        fontFamily: FONT,
        fontSize: fs(30),
        color: PALETTE.cream,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(D + 2),
  );

  RULES.forEach((line, i) => {
    parts.push(
      scene.add
        .text(STAGE_W / 2 - pw / 2 + 28 * sc, top + (56 + i * 38) * sc, line, {
          fontFamily: FONT,
          fontSize: fs(19),
          color: '#f2e3c4',
          wordWrap: { width: pw - 56 * sc },
        })
        .setOrigin(0, 0)
        .setDepth(D + 2),
    );
  });

  parts.push(
    scene.add
      .text(STAGE_W / 2, top + 262 * sc, DEVICES, { fontFamily: FONT, fontSize: fs(17), color: '#d8bd92' })
      .setOrigin(0.5, 0)
      .setDepth(D + 2),
    scene.add
      .text(STAGE_W / 2, top + 294 * sc, ITEMS, { fontFamily: FONT, fontSize: fs(17), color: '#ffd76a' })
      .setOrigin(0.5, 0)
      .setDepth(D + 2),
  );

  // 닫기 버튼
  const bw = Math.round(200 * sc);
  const bh = Math.round(56 * sc);
  const by = top + ph - 84 * sc;
  const btn = scene.add.container(STAGE_W / 2, by).setDepth(D + 3);
  btn.add([
    scene.add.image(
      0,
      0,
      panelTexture(scene, `help-close-${bw}`, bw, bh, {
        top: PALETTE.goldTop,
        bottom: PALETTE.goldBottom,
        shadow: PALETTE.goldShadow,
        radius: 12,
        gloss: 0.55,
      }),
    ),
    scene.add
      .text(0, 0, '알겠어요', { fontFamily: FONT, fontSize: fs(22), color: PALETTE.goldText, fontStyle: 'bold' })
      .setOrigin(0.5),
  ]);
  btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
  parts.push(btn);

  const close = (): void => {
    markHelpSeen();
    for (const p of parts) p.destroy();
    onClose?.();
  };
  btn.on('pointerdown', close);
  dim.on('pointerdown', close);
}
