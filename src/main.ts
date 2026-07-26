import Phaser from 'phaser';
import { PlayScene } from './game/play-scene';

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
  scene: [PlayScene],
});

// 개발 모드에서만 콘솔·자동화 디버깅용으로 노출 (프로덕션 번들에는 포함되지 않음)
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
