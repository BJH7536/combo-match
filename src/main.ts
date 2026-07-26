import Phaser from 'phaser';
import { stageSize } from './game/layout';
import { LevelSelectScene } from './game/level-select-scene';
import { PlayScene } from './game/play-scene';

// 디자이너 툴이 넘긴 `#level=<base64>`가 있으면 곧바로 플레이로 진입한다 (핸드오프 유지).
// 그 외에는 레벨 선택이 첫 화면.
const hasHandoff = /^#level=/.test(window.location.hash);

// 스테이지 비율을 실제 화면 비율에 맞춰 잡는다 — FIT으로 스케일되므로 여백이 최소화된다
const { W, H } = stageSize(window.innerWidth, window.innerHeight, window.devicePixelRatio);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1d1610',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: hasHandoff ? [PlayScene, LevelSelectScene] : [LevelSelectScene, PlayScene],
});

// 회전·창 크기 변경: 스테이지 비율을 다시 잡고 활성 씬을 재구성한다.
// 씬은 init 데이터를 보존하므로 재시작해도 같은 레벨이 유지된다.
let resizeTimer: number | undefined;
const onViewportChange = (): void => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const next = stageSize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    if (Math.abs(next.W - game.scale.width) < 4 && Math.abs(next.H - game.scale.height) < 4) return;
    game.scale.resize(next.W, next.H);
    for (const sc of game.scene.getScenes(true)) sc.scene.restart();
  }, 220);
};
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);

// 개발 모드에서만 콘솔·자동화 디버깅용으로 노출 (프로덕션 번들에는 포함되지 않음)
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
