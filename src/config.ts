import Phaser from "phaser";
import { COLORS } from "./theme";
import { GAME_WIDTH, GAME_HEIGHT } from "./dimensions";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { CaseSelectScene } from "./scenes/CaseSelectScene";
import { StatsScene } from "./scenes/StatsScene";
import { CaseScene } from "./scenes/CaseScene";

export { GAME_WIDTH, GAME_HEIGHT } from "./dimensions";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,
  },
  scene: [BootScene, TitleScene, CaseSelectScene, StatsScene, CaseScene],
};
