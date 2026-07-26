import Phaser from 'phaser';
import { LevelSelectScene } from './game/level-select-scene';
import { PlayScene } from './game/play-scene';

// 디자이너 툴이 넘긴 `#level=<base64>`가 있으면 곧바로 플레이로 진입한다 (핸드오프 유지).
// 그 외에는 레벨 선택이 첫 화면.
const hasHandoff = /^#level=/.test(window.location.hash);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 760,
  backgroundColor: '#1d1610',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: hasHandoff ? [PlayScene, LevelSelectScene] : [LevelSelectScene, PlayScene],
});

// 개발 모드에서만 콘솔·자동화 디버깅용으로 노출 (프로덕션 번들에는 포함되지 않음)
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
