import Phaser from "phaser";
import { generateTextures } from "../game/textures";

/** Generates all runtime art once, then hands off to the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    generateTextures(this);
    this.scene.start("TitleScene");
  }
}
