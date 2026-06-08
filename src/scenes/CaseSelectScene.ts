import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, MONO } from "../theme";
import { Button } from "../ui";
import { addAtmosphere } from "../game/textures";
import { generateMergedCase } from "../game/generateweb";
import { freeOpts } from "../game/ladder";
import { suspectName } from "../game/portrait";
import { getBest } from "../game/save";
import { SFX } from "../game/audio";
import { PAD } from "../input";

// Curated cold-case seeds — hand-picked for variety (a couple hide a keystone).
// Fixed, so they always play exactly as listed and you can chase your best.
export const COLD_CASES = [2, 11, 23, 47, 88, 134];

/** The cold files: a gallery of fixed cases to replay and break tighter. */
export class CaseSelectScene extends Phaser.Scene {
  constructor() {
    super("CaseSelect");
  }

  create(): void {
    this.cameras.main.fadeIn(320);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });

    this.add
      .text(GAME_WIDTH / 2, 52, "COLD FILES", { fontFamily: DISPLAY, fontSize: "30px", color: CSS.ink })
      .setOrigin(0.5)
      .setLetterSpacing(6);
    this.add
      .text(GAME_WIDTH / 2, 84, "fixed cases — break them tighter", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(0.5);

    const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
    const items: { btn: Button; fn: () => void }[] = [];
    let y = 134;
    COLD_CASES.forEach((seed, i) => {
      const c = generateMergedCase(seed, freeOpts(seed));
      const best = getBest(`case-${seed}`);
      const name = suspectName(seed);
      const label = `${ROMAN[i]}.  ${c.title}`;
      const sub = `${name}${best != null ? `   ·   best ${best}` : ""}`;
      const fn = () => this.scene.start("CaseRun", { generate: true, seed, fixed: true });
      const btn = new Button(this, GAME_WIDTH / 2, y, { w: 410, h: 50, label, fontSize: 14, accent: COLORS.slate, onClick: fn });
      this.add.text(GAME_WIDTH / 2, y + 26, sub, { fontFamily: MONO, fontSize: "10px", color: CSS.faint }).setOrigin(0.5);
      items.push({ btn, fn });
      y += 70;
    });

    const back = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, { w: 200, h: 50, label: "BACK", accent: COLORS.crimson, onClick: () => this.scene.start("TitleScene") });
    items.push({ btn: back, fn: () => this.scene.start("TitleScene") });

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
  }
}
