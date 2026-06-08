import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { addAtmosphere } from "../game/textures";
import { startAmbience, isMuted, toggleMute, SFX, stopSpeech } from "../game/audio";
import { getReduceMotion, toggleReduceMotion, getNarration, toggleNarration, getDifficulty, cycleDifficulty, DIFFS } from "../game/save";
import { getCleared, getDeepest, hasSeenIntro, markSeenIntro, getTotalBreaks, rankFor } from "../game/save";
import { CASES } from "../game/cases";
import { PAD } from "../input";

export class TitleScene extends Phaser.Scene {
  private overlayClose: (() => void) | null = null;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(500);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    const { lamp } = addAtmosphere(this, { lamp: true });
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
      this.scene.start("CaseScene", { mode: "daily" });
    };
    const dailyText = this.add
      .text(GAME_WIDTH / 2, 360, "» today's subject «", { fontFamily: MONO, fontSize: "12px", color: CSS.slate })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    dailyText.on("pointerup", daily);
    this.input.keyboard?.on("keydown-T", daily);

    const record = this.add
      .text(GAME_WIDTH / 2, 384, "» the record «", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    record.on("pointerup", () => this.scene.start("Stats"));

    // The redesign prototype — a real case, evidence, the new loop.
    const beta = this.add
      .text(GAME_WIDTH / 2, 400, "❖  THE CASE  (beta)  ❖", { fontFamily: MONO, fontSize: "12px", color: CSS.crimsonBright })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    beta.on("pointerup", () => {
      startAmbience();
      this.scene.start("CaseRun");
    });
    this.input.keyboard?.on("keydown-N", () => {
      startAmbience();
      this.scene.start("CaseRun");
    });

    const web = this.add
      .text(GAME_WIDTH / 2, 424, "❖  THE WEB  (beta)  ❖", { fontFamily: MONO, fontSize: "12px", color: CSS.crimsonBright })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    web.on("pointerup", () => {
      startAmbience();
      this.scene.start("Web");
    });
    this.input.keyboard?.on("keydown-W", () => {
      startAmbience();
      this.scene.start("Web");
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
    const coop = () => {
      startAmbience();
      this.scene.start("CaseScene", { mode: "coop" });
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

    const cleared = getCleared();
    const deepest = getDeepest();
    const total = getTotalBreaks();
    const lines: string[] = [];
    if (total > 0) lines.push(`rank: ${rankFor(total)}`);
    if (cleared > 0) lines.push(`story ${Math.min(cleared, CASES.length)}/${CASES.length}`);
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
          "A subject tells their story. The truth holds still — but a lie cannot tell itself the same way twice.\n\n• AGAIN — make them retell it. Watch what moves.\n• PRESS — lean on a line so it slips sooner; lean hard and its evidence may surface.\n• PIN — accuse a line you've seen move (or proven by evidence). Pin enough to break the story.\n\nPin a line that never moved and you've accused the truth — that costs a strike.\n\nMind the pressure: lean too hard and the subject steadies, undoing your work.",
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
