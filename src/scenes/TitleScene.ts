import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { addAtmosphere } from "../game/textures";
import { startAmbience } from "../game/audio";
import { getCleared, getDeepest } from "../game/save";
import { CASES } from "../game/cases";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    const { lamp } = addAtmosphere(this, { lamp: true });
    if (lamp) {
      this.tweens.add({ targets: lamp, alpha: { from: 0.7, to: 1 }, scale: { from: 0.98, to: 1.05 }, duration: 3600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

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

    const begin = () => {
      startAmbience();
      this.scene.start("CaseScene", { mode: "story", caseIndex: 0 });
    };
    const endless = () => {
      startAmbience();
      this.scene.start("CaseScene", { mode: "endless", depth: 0 });
    };

    const versus = () => {
      startAmbience();
      this.scene.start("CaseScene", { mode: "versus" });
    };

    new Button(this, GAME_WIDTH / 2, 560, {
      w: 240,
      h: 50,
      label: "SIT DOWN",
      accent: COLORS.crimson,
      onClick: begin,
    });
    new Button(this, GAME_WIDTH / 2, 618, {
      w: 240,
      h: 48,
      label: "AN ENDLESS NIGHT",
      accent: COLORS.slate,
      onClick: endless,
    });
    new Button(this, GAME_WIDTH / 2, 672, {
      w: 240,
      h: 48,
      label: "TWO DETECTIVES",
      accent: COLORS.amber,
      onClick: versus,
    });

    // Gamepad / keyboard: A / Enter takes the story; Space / X takes the endless night.
    this.input.gamepad?.once("down", begin);
    this.input.keyboard?.once("keydown-ENTER", begin);
    this.input.keyboard?.once("keydown-SPACE", endless);

    this.add
      .text(GAME_WIDTH / 2, 716, "touch · gamepad · keyboard", {
        fontFamily: MONO,
        fontSize: "10px",
        color: CSS.faint,
      })
      .setOrigin(0.5);

    const cleared = getCleared();
    const deepest = getDeepest();
    const lines: string[] = [];
    if (cleared > 0) lines.push(`stories broken: ${Math.min(cleared, CASES.length)} / ${CASES.length}`);
    if (deepest > 0) lines.push(`deepest night: ${deepest}`);
    if (lines.length > 0) {
      this.add
        .text(GAME_WIDTH / 2, 742, lines.join("      "), { fontFamily: MONO, fontSize: "11px", color: CSS.amber })
        .setOrigin(0.5);
    }

    this.add
      .text(GAME_WIDTH / 2, 800, "an arrow travels in only one direction", {
        fontFamily: MONO,
        fontSize: "11px",
        color: CSS.faint,
      })
      .setOrigin(0.5);
  }
}
