import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { addAtmosphere, addRain } from "../game/textures";
import { startAmbience, isMuted, toggleMute, SFX, stopSpeech } from "../game/audio";
import { getReduceMotion, toggleReduceMotion, getNarration, toggleNarration, getDifficulty, cycleDifficulty, DIFFS, getWeirdness, cycleWeirdness, WEIRDS } from "../game/save";
import { getDeepest, hasSeenIntro, markSeenIntro, getTotalBreaks, rankFor, getBest } from "../game/save";
import { generateMergedCase } from "../game/generateweb";
import { dailySeed, DAILY_OPTS } from "../game/ladder";
import { verifyWeb } from "../game/verify";
import { todayStamp } from "../game/rng";
import { PAD } from "../input";

export class TitleScene extends Phaser.Scene {
  private overlayClose: (() => void) | null = null;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    stopSpeech();
    // Dev shortcut: ?web=keystone&seed=11 boots straight into a forced case.
    const params = new URLSearchParams(location.search);
    if (params.get("web")) {
      startAmbience();
      this.scene.start("Web", { generate: true, seed: Number(params.get("seed") ?? 11), keystone: params.get("web") === "keystone" });
      return;
    }
    this.cameras.main.fadeIn(500);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    if (this.textures.exists("blinds")) this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "blinds").setDepth(-2).setAlpha(0.5);
    const { lamp } = addAtmosphere(this, { lamp: true });
    addRain(this, -1, 1);
    if (lamp) {
      this.tweens.add({ targets: lamp, alpha: { from: 0.7, to: 1 }, scale: { from: 0.98, to: 1.05 }, duration: 3600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    // Faint offset echo behind the title, for depth.
    this.add
      .text(GAME_WIDTH / 2 + 3, 253, "AGAIN", { fontFamily: DISPLAY, fontSize: "76px", color: "#000000" })
      .setOrigin(0.5)
      .setLetterSpacing(14)
      .setAlpha(0.5);
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

    // Daily challenge — distinct from the main menu, same subject for everyone.
    const daily = () => {
      startAmbience();
      this.scene.start("CaseRun", { mode: "daily" });
    };
    const dailyText = this.add
      .text(GAME_WIDTH / 2, 358, "» today's subject «", { fontFamily: MONO, fontSize: "12px", color: CSS.slate })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    dailyText.on("pointerup", daily);
    this.input.keyboard?.on("keydown-T", daily);

    // Today's par-chase status, so the daily reads as an optimization target.
    try {
      const seed = dailySeed();
      const c = generateMergedCase(seed, DAILY_OPTS);
      const par = Math.max(2, c.phases.length * 2 + verifyWeb(c.web, c.web.startEvidence).order.length);
      const best = getBest(`daily-${todayStamp()}`);
      const status = best != null ? `solved in ${best}  ·  par ${par}${best <= par ? "  ✦" : ""}` : `unbroken  ·  par ${par}`;
      this.add.text(GAME_WIDTH / 2, 374, status, { fontFamily: MONO, fontSize: "10px", color: best != null && best <= par ? CSS.amber : CSS.faint }).setOrigin(0.5);
    } catch {
      /* generation guard — skip the status line */
    }

    const record = this.add
      .text(GAME_WIDTH / 2, 392, "» the record «", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    record.on("pointerup", () => this.scene.start("Stats"));

    // Quiet shortcuts: the crafted case (N) and a fresh generated one (W).
    this.input.keyboard?.on("keydown-N", () => {
      startAmbience();
      this.scene.start("CaseRun");
    });
    this.input.keyboard?.on("keydown-W", () => {
      startAmbience();
      this.scene.start("CaseRun", { generate: true });
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        462,
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
      this.scene.start("CaseRun", { generate: true });
    };
    const endless = () => {
      startAmbience();
      this.scene.start("CaseRun", { mode: "endless", night: 1 });
    };

    const versus = () => {
      startAmbience();
      this.scene.start("CaseRun", { vsMode: "versus" });
    };
    const coop = () => {
      startAmbience();
      this.scene.start("CaseRun", { vsMode: "coop" });
    };

    const revisit = () => this.scene.start("CaseSelect");
    const items: { btn: Button; fn: () => void }[] = [
      { btn: new Button(this, GAME_WIDTH / 2, 516, { w: 240, h: 44, label: "SIT DOWN", accent: COLORS.crimson, onClick: begin }), fn: begin },
      { btn: new Button(this, GAME_WIDTH / 2, 564, { w: 240, h: 44, label: "AN ENDLESS NIGHT", accent: COLORS.slate, onClick: endless }), fn: endless },
      { btn: new Button(this, GAME_WIDTH / 2, 612, { w: 240, h: 44, label: "TWO DETECTIVES — VERSUS", accent: COLORS.amber, onClick: versus }), fn: versus },
      { btn: new Button(this, GAME_WIDTH / 2, 660, { w: 240, h: 44, label: "PARTNERS — CO-OP", accent: COLORS.amber, onClick: coop }), fn: coop },
      { btn: new Button(this, GAME_WIDTH / 2, 708, { w: 240, h: 44, label: "CASE FILES", accent: COLORS.slate, onClick: revisit }), fn: revisit },
    ];

    // Full gamepad / keyboard navigation of the menu.
    let focus = 0;
    const updateFocus = () => items.forEach((it, i) => it.btn.setActive2(i === focus));
    updateFocus();
    const move = (d: number) => {
      if (this.overlayClose) return;
      focus = Phaser.Math.Wrap(focus + d, 0, items.length);
      updateFocus();
      SFX.select();
    };
    const confirm = () => {
      if (this.overlayClose) {
        this.overlayClose();
        return;
      }
      items[focus].fn();
    };

    this.input.keyboard?.on("keydown-UP", () => move(-1));
    this.input.keyboard?.on("keydown-DOWN", () => move(1));
    this.input.keyboard?.on("keydown-ENTER", confirm);
    this.input.keyboard?.on("keydown-SPACE", confirm);
    this.input.keyboard?.on("keydown-ESC", () => this.overlayClose?.());
    this.input.gamepad?.on("down", (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      if (this.overlayClose) {
        if (b.index === PAD.A || b.index === PAD.B || b.index === PAD.START) this.overlayClose();
        return;
      }
      if (b.index === PAD.UP) move(-1);
      else if (b.index === PAD.DOWN) move(1);
      else if (b.index === PAD.A || b.index === PAD.START) confirm();
    });

    this.add
      .text(GAME_WIDTH / 2, 738, "touch · gamepad · keyboard", {
        fontFamily: MONO,
        fontSize: "10px",
        color: CSS.faint,
      })
      .setOrigin(0.5);

    // How-it-works, top-left (auto-opens on first ever launch).
    const help = this.add
      .text(16, 22, "?  how it works", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    help.on("pointerup", () => this.showHelp());

    // Fullscreen — the readable way to play on desktop.
    const fs = this.add
      .text(16, 42, "⛶  fullscreen", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    fs.on("pointerup", () => this.scale.toggleFullscreen());
    this.input.keyboard?.on("keydown-F", () => this.scale.toggleFullscreen());

    if (!hasSeenIntro()) {
      markSeenIntro();
      this.showHelp();
    }

    // Settings, consolidated behind one link (top-right).
    const settings = this.add
      .text(GAME_WIDTH - 16, 22, "settings  ⚙", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    settings.on("pointerup", () => this.showSettings());

    const deepest = getDeepest();
    const total = getTotalBreaks();
    const lines: string[] = [];
    if (total > 0) lines.push(`rank: ${rankFor(total)}`);
    if (total > 0) lines.push(`${total} broken`);
    if (deepest > 0) lines.push(`deepest ${deepest}`);
    if (lines.length > 0) {
      this.add
        .text(GAME_WIDTH / 2, 762, lines.join("   ·   "), { fontFamily: MONO, fontSize: "11px", color: CSS.amber })
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

  private showSettings(): void {
    SFX.page();
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    c.add(
      this.add
        .text(GAME_WIDTH / 2, 180, "settings", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" })
        .setOrigin(0.5),
    );

    const rows: { label: () => string; act: () => void }[] = [
      { label: () => `sound        ${isMuted() ? "off" : "on"}`, act: () => void toggleMute() },
      { label: () => `motion       ${getReduceMotion() ? "reduced" : "full"}`, act: () => void toggleReduceMotion() },
      { label: () => `narration    ${getNarration() ? "on" : "off"}`, act: () => void toggleNarration() },
      { label: () => `difficulty   ${DIFFS[getDifficulty()].label}`, act: () => void cycleDifficulty() },
      { label: () => `weirdness    ${WEIRDS[getWeirdness()].label}`, act: () => void cycleWeirdness() },
    ];
    let y = 270;
    for (const r of rows) {
      const t = this.add
        .text(GAME_WIDTH / 2, y, r.label(), { fontFamily: MONO, fontSize: "16px", color: CSS.ink })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on("pointerup", () => {
        SFX.select();
        r.act();
        t.setText(r.label());
      });
      c.add(t);
      y += 44;
    }

    const close = () => {
      c.destroy();
      this.overlayClose = null;
    };
    this.overlayClose = close;
    c.add(new Button(this, GAME_WIDTH / 2, y + 24, { w: 200, h: 48, label: "DONE", accent: COLORS.crimson, onClick: close }));
  }

  private showHelp(): void {
    SFX.page();
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    c.add(
      this.add
        .text(GAME_WIDTH / 2, 150, "how it works", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          GAME_WIDTH / 2,
          200,
          "A subject tells their story. The truth holds still — but a lie cannot tell itself the same way twice.\n\nFIRST, you question them point by point:\n• QUESTION — make them say a line again. A lie shifts; the truth doesn't move.\n• PIN — accuse a line you've caught shifting, and it becomes a lead. Pin the truth and that's a strike; three closes the point — but you keep the leads you have.\n\nTHEN comes the confrontation — the whole alibi at once:\n• PRESS him with a lead. A head-on hit just deflects: the lie hides behind a supporting lie, so break that prop first, then the lie above it.\n• One lie may be holding up all the others. Find that keystone and the whole story caves at once.",
          { fontFamily: BODY, fontSize: "15px", color: CSS.ink, align: "left", wordWrap: { width: 400 }, lineSpacing: 6 },
        )
        .setOrigin(0.5, 0),
    );
    const dismiss = () => {
      c.destroy();
      this.overlayClose = null;
    };
    this.overlayClose = dismiss;
    const close = new Button(this, GAME_WIDTH / 2, 720, {
      w: 200,
      h: 50,
      label: "GOT IT  (A / Enter)",
      accent: COLORS.crimson,
      onClick: dismiss,
    });
    c.add(close);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 300 });
  }
}
