import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, MONO } from "../theme";
import { Button } from "../ui";
import { addAtmosphere } from "../game/textures";
import { generateMergedCase } from "../game/generateweb";
import { freeOpts } from "../game/ladder";
import { COLD_CASES } from "./CaseSelectScene";
import { getTotalBreaks, rankFor, getBest, getDeepest, getCleanCount } from "../game/save";
import { todayStamp } from "../game/rng";
import { PAD } from "../input";

/** The detective's record — everything the saves remember, in one dossier. */
export class StatsScene extends Phaser.Scene {
  constructor() {
    super("Stats");
  }

  create(): void {
    this.cameras.main.fadeIn(320);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });

    this.add
      .text(GAME_WIDTH / 2, 56, "THE RECORD", { fontFamily: DISPLAY, fontSize: "30px", color: CSS.ink })
      .setOrigin(0.5)
      .setLetterSpacing(6);

    const total = getTotalBreaks();
    const deepest = getDeepest();
    const dailyBest = getBest(`daily-${todayStamp()}`);

    this.add
      .text(GAME_WIDTH / 2, 108, `${rankFor(total)}`, { fontFamily: DISPLAY, fontSize: "20px", color: CSS.amber, fontStyle: "italic" })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 138, `${total} broken, all told   ·   ${getCleanCount()} clean ✦`, { fontFamily: MONO, fontSize: "12px", color: CSS.muted })
      .setOrigin(0.5);

    const rows: string[] = ["— the cold files —"];
    const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
    COLD_CASES.forEach((seed, i) => {
      const c = generateMergedCase(seed, freeOpts(seed));
      const best = getBest(`case-${seed}`);
      rows.push(`${(ROMAN[i] + ".  " + c.title).padEnd(26, " ")}${best != null ? `best ${best}` : "— open —"}`);
    });
    rows.push("");
    rows.push("— the long nights —");
    rows.push(`deepest night reached   ${deepest || "—"}`);
    rows.push(`today's subject (best)  ${dailyBest != null ? dailyBest + " moves" : "—"}`);

    this.add
      .text(GAME_WIDTH / 2, 180, rows.join("\n"), { fontFamily: MONO, fontSize: "13px", color: CSS.ink, align: "left", lineSpacing: 6 })
      .setOrigin(0.5, 0);

    const back = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, {
      w: 200,
      h: 50,
      label: "BACK",
      accent: COLORS.crimson,
      onClick: () => this.scene.start("TitleScene"),
    }).setActive2(true);

    const toTitle = () => this.scene.start("TitleScene");
    this.input.keyboard?.on("keydown-ENTER", toTitle);
    this.input.keyboard?.on("keydown-ESC", toTitle);
    this.input.gamepad?.on("down", (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      if (b.index === PAD.A || b.index === PAD.B || b.index === PAD.START) toTitle();
    });
    void back;
  }
}
