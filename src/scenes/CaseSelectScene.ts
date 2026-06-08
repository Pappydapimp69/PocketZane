import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { COLORS, CSS, DISPLAY, MONO } from "../theme";
import { Button } from "../ui";
import { addAtmosphere } from "../game/textures";
import { CASES } from "../game/cases";
import { getCleared, getBest, isCleanCase } from "../game/save";
import { SFX } from "../game/audio";
import { PAD } from "../input";

/** Revisit any reached case — replay to beat your best telling count. */
export class CaseSelectScene extends Phaser.Scene {
  constructor() {
    super("CaseSelect");
  }

  create(): void {
    this.cameras.main.fadeIn(320);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, {});

    this.add
      .text(GAME_WIDTH / 2, 56, "CASE FILES", { fontFamily: DISPLAY, fontSize: "30px", color: CSS.ink })
      .setOrigin(0.5)
      .setLetterSpacing(6);

    const cleared = getCleared();
    const items: { btn: Button; fn: () => void }[] = [];
    let y = 140;
    CASES.forEach((c, i) => {
      const unlocked = i <= cleared;
      const best = getBest(c.id);
      const clean = isCleanCase(c.id) ? "  ✦" : "";
      const label = unlocked ? `${c.title}${best != null ? `   ·   best ${best}×` : ""}${clean}` : `${c.title.split(".")[0]}.  — sealed —`;
      const fn = () => this.scene.start("CaseScene", { mode: "story", caseIndex: i });
      const btn = new Button(this, GAME_WIDTH / 2, y, {
        w: 410,
        h: 52,
        label,
        fontSize: 14,
        accent: COLORS.slate,
        onClick: unlocked ? fn : () => SFX.deny(),
      });
      if (!unlocked) btn.setEnabled(false);
      else items.push({ btn, fn });
      y += 64;
    });

    const back = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, {
      w: 200,
      h: 50,
      label: "BACK",
      accent: COLORS.crimson,
      onClick: () => this.scene.start("TitleScene"),
    });
    items.push({ btn: back, fn: () => this.scene.start("TitleScene") });

    // Navigation (touch + gamepad + keyboard).
    let focus = 0;
    const updateFocus = () => items.forEach((it, idx) => it.btn.setActive2(idx === focus));
    updateFocus();
    const move = (d: number) => {
      focus = Phaser.Math.Wrap(focus + d, 0, items.length);
      updateFocus();
      SFX.select();
    };
    const confirm = () => items[focus].fn();

    this.input.keyboard?.on("keydown-UP", () => move(-1));
    this.input.keyboard?.on("keydown-DOWN", () => move(1));
    this.input.keyboard?.on("keydown-ENTER", confirm);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("TitleScene"));
    this.input.gamepad?.on("down", (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      if (b.index === PAD.UP) move(-1);
      else if (b.index === PAD.DOWN) move(1);
      else if (b.index === PAD.A) confirm();
      else if (b.index === PAD.B) this.scene.start("TitleScene");
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 24, `broken ${Math.min(cleared, CASES.length)} / ${CASES.length}`, {
        fontFamily: MONO,
        fontSize: "11px",
        color: CSS.faint,
      })
      .setOrigin(0.5);
  }
}
