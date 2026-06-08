import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    const title = this.add
      .text(GAME_WIDTH / 2, 250, "AGAIN", { fontFamily: DISPLAY, fontSize: "76px", color: CSS.ink })
      .setOrigin(0.5)
      .setLetterSpacing(14);
    this.tweens.add({ targets: title, alpha: { from: 0, to: 1 }, duration: 1400 });

    this.add
      .text(GAME_WIDTH / 2, 320, "a cross-examination", {
        fontFamily: DISPLAY,
        fontSize: "16px",
        color: CSS.amber,
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        430,
        "The truth holds still.\nA lie cannot tell itself the same way twice.\n\nAsk them to tell it again. Watch what moves.\nPin what won't hold its shape.",
        {
          fontFamily: BODY,
          fontSize: "16px",
          color: CSS.muted,
          align: "center",
          lineSpacing: 7,
        },
      )
      .setOrigin(0.5);

    const begin = () => this.scene.start("CaseScene", { caseIndex: 0 });
    new Button(this, GAME_WIDTH / 2, 600, {
      w: 240,
      h: 56,
      label: "SIT DOWN",
      accent: COLORS.crimson,
      onClick: begin,
    });

    // Gamepad / keyboard: any face button or Enter/Space begins.
    this.input.gamepad?.once("down", begin);
    this.input.keyboard?.once("keydown-ENTER", begin);
    this.input.keyboard?.once("keydown-SPACE", begin);

    this.add
      .text(GAME_WIDTH / 2, 660, "touch · gamepad · keyboard", {
        fontFamily: MONO,
        fontSize: "10px",
        color: CSS.faint,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 800, "an arrow travels in only one direction", {
        fontFamily: MONO,
        fontSize: "11px",
        color: CSS.faint,
      })
      .setOrigin(0.5);
  }
}
