import Phaser from 'phaser';
import { PlayScene } from './game/play-scene';

new Phaser.Game({
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
