import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { Interrogation, LineView, Case } from "../game/engine";
import { CASES } from "../game/cases";
import { SFX, startAmbience, speak, stopSpeech } from "../game/audio";
import { addAtmosphere } from "../game/textures";
import { markCleared, getBest, setBest, markDeepest, getDeepest, incBreaks, getReduceMotion, getNarration, getDifficulty, DIFFS, markCleanCase } from "../game/save";
import { generateCase } from "../game/generator";
import { mulberry32, todaySeed, todayStamp } from "../game/rng";
import { tell } from "../game/reactions";
import { PAD, STICK_THRESHOLD, STICK_REPEAT_MS } from "../input";

const CARD_X = GAME_WIDTH / 2;
const CARD_W = 432;
const WRAP = 392;
const LIST_TOP = 150;

export class CaseScene extends Phaser.Scene {
  private game_!: Interrogation;
  private caseIndex = 0;
  private mode: "story" | "endless" | "versus" | "coop" | "daily" = "story";
  private depth = 0;
  private activePlayer = 0;
  private scores = [0, 0];
  private lastStriker = 0;
  private turnBanner?: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private pressureBar!: Phaser.GameObjects.Graphics;
  private cards: Phaser.GameObjects.Container[] = [];
  private selected: string | null = null;
  private pressBtn!: Button;
  private pinBtn!: Button;
  private ledger: string[][] = [];
  private busy = false;
  private overlayAction: (() => void) | null = null;
  private stickCooldown = 0;
  private lamp?: Phaser.GameObjects.Image;
  private tension?: Phaser.GameObjects.Image;
  private prevHigh = false;

  constructor() {
    super("CaseScene");
  }

  init(data: { caseIndex?: number; mode?: "story" | "endless" | "versus" | "coop" | "daily"; depth?: number }): void {
    this.mode = data?.mode ?? "story";
    this.caseIndex = data?.caseIndex ?? 0;
    this.depth = data?.depth ?? 0;
    this.activePlayer = 0;
    this.scores = [0, 0];
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(380);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    this.lamp = addAtmosphere(this, { lamp: true }).lamp;
    startAmbience();

    // A crimson tension vignette that closes in as the pressure climbs.
    if (this.textures.exists("vignette")) {
      this.tension = this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette")
        .setDepth(91)
        .setTint(0x8b1e1e)
        .setAlpha(0);
    }
    this.prevHigh = false;

    let chosen: Case;
    let playRng: (() => number) | undefined;
    if (this.mode === "daily") {
      // Same subject for everyone, all day; deterministic case and slips.
      const seed = todaySeed();
      chosen = generateCase(2, mulberry32(seed));
      chosen.id = `daily-${todayStamp()}`;
      chosen.title = `Today — ${todayStamp()}`;
      playRng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    } else if (this.mode === "endless") {
      // Every fifth night is a harder, named "hard case."
      const isBoss = (this.depth + 1) % 5 === 0;
      chosen = generateCase(this.depth + (isBoss ? 2 : 0));
      if (isBoss) chosen.title = `Night ${this.depth + 1} — the hard one`;
    } else {
      chosen =
        this.mode === "versus"
          ? generateCase(2)
          : this.mode === "coop"
            ? generateCase(4) // a hard one, meant for two heads
            : CASES[this.caseIndex];
    }
    // Apply the chosen difficulty's strike modifier (copy so shared cases aren't mutated).
    const off = DIFFS[getDifficulty()].strikes;
    chosen = { ...chosen, strikes: Phaser.Math.Clamp(chosen.strikes + off, 1, 9) };
    this.game_ = new Interrogation(chosen, playRng);
    this.ledger = [];
    this.selected = null;
    this.busy = false;

    this.buildHeader();
    this.buildControls();
    this.renderCards();
    this.updateHud();
    this.setupDeviceInput();

    const t = this.game_.case.temperament;
    if (t) this.setStatus(`reads as: ${t.label} — ${t.hint}`, CSS.slate);
  }

  // ---- gamepad + keyboard ----------------------------------------------------

  private setupDeviceInput(): void {
    this.input.gamepad?.on("down", (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      this.onButton(button.index);
    });

    const kb = this.input.keyboard;
    kb?.on("keydown-UP", () => this.onButton(PAD.UP));
    kb?.on("keydown-DOWN", () => this.onButton(PAD.DOWN));
    kb?.on("keydown-ENTER", () => this.onButton(PAD.A));
    kb?.on("keydown-SPACE", () => this.onButton(PAD.A));
    kb?.on("keydown-P", () => this.onButton(PAD.X));
    kb?.on("keydown-K", () => this.onButton(PAD.Y));
    kb?.on("keydown-L", () => this.onButton(PAD.LB));
    kb?.on("keydown-ESC", () => {
      if (!this.busy) this.confirmLeave();
    });
  }

  private confirmLeave(): void {
    if (this.busy) return;
    this.busy = true;
    const c = this.add.container(0, 0).setDepth(130);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.9));
    c.add(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "Leave this one?\nNothing here is saved.", {
          fontFamily: BODY,
          fontSize: "17px",
          color: CSS.ink,
          align: "center",
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );
    const stay = () => {
      c.destroy();
      this.busy = false;
      this.overlayAction = null;
    };
    this.overlayAction = stay;
    c.add(new Button(this, GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2 + 20, { w: 140, h: 48, label: "STAY", accent: COLORS.slate, onClick: stay }));
    c.add(new Button(this, GAME_WIDTH / 2 + 80, GAME_HEIGHT / 2 + 20, { w: 140, h: 48, label: "LEAVE", accent: COLORS.crimson, onClick: () => this.scene.start("TitleScene") }));
  }

  /** Map a (gamepad or keyboard-aliased) button to an action. */
  private onButton(index: number): void {
    if (this.busy) {
      if ((index === PAD.A || index === PAD.START || index === PAD.B) && this.overlayAction) this.overlayAction();
      return;
    }
    switch (index) {
      case PAD.UP:
        this.moveSelection(-1);
        break;
      case PAD.DOWN:
        this.moveSelection(1);
        break;
      case PAD.A:
        this.doAgain();
        break;
      case PAD.X:
        this.doPress();
        break;
      case PAD.Y:
        this.doPin();
        break;
      case PAD.LB:
        this.showLedger();
        break;
      case PAD.START:
        this.confirmLeave();
        break;
      case PAD.B:
        this.clearSelection();
        break;
    }
  }

  private showLedger(): void {
    if (this.busy) return;
    SFX.page();
    const entries = this.game_.ledgerView();
    const body =
      entries.length === 0
        ? "Nothing caught yet.\n\nMake them tell it again, and watch which lines won't hold their shape."
        : entries
            .map(
              (e) =>
                `${e.pinned ? "✕" : "▲"}  ` +
                e.phrasings.map((p) => `“${p}”`).join("\n      …  ") +
                (e.evidence ? `\n      ⟐ ${e.evidence}` : ""),
            )
            .join("\n\n");

    this.busy = true;
    const c = this.add.container(0, 0).setDepth(120);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    if (this.textures.exists("vignette")) c.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    c.add(
      this.add
        .text(GAME_WIDTH / 2, 90, "the ledger", { fontFamily: DISPLAY, fontSize: "24px", color: CSS.amber, fontStyle: "italic" })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(GAME_WIDTH / 2, 140, body, { fontFamily: MONO, fontSize: "12px", color: CSS.ink, align: "left", wordWrap: { width: 404 }, lineSpacing: 3 })
        .setOrigin(0.5, 0),
    );
    const close = () => {
      c.destroy();
      this.busy = false;
      this.overlayAction = null;
    };
    this.overlayAction = close;
    const btn = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, { w: 200, h: 48, label: "CLOSE", accent: COLORS.slate, onClick: close });
    c.add(btn);
  }

  update(_time: number, delta: number): void {
    // Left-stick (and d-pad-as-axis) discrete stepping through statements.
    this.stickCooldown -= delta;
    const pad = this.input.gamepad?.getPad(0);
    if (!pad || this.busy || this.stickCooldown > 0) return;
    const y = pad.leftStick.y;
    if (Math.abs(y) > STICK_THRESHOLD) {
      this.moveSelection(y > 0 ? 1 : -1);
      this.stickCooldown = STICK_REPEAT_MS;
    }
  }

  private selectableIds(): string[] {
    return this.game_.view().filter((v) => !v.pinned).map((v) => v.id);
  }

  private moveSelection(dir: number): void {
    const ids = this.selectableIds();
    if (ids.length === 0) return;
    const cur = this.selected ? ids.indexOf(this.selected) : -1;
    const next = cur < 0 ? (dir > 0 ? 0 : ids.length - 1) : Phaser.Math.Wrap(cur + dir, 0, ids.length);
    this.selected = ids[next];
    this.pinBtn.setEnabled(true);
    this.pressBtn.setEnabled(true);
    this.repaintCards();
    SFX.select();
  }

  private clearSelection(): void {
    this.selected = null;
    this.pinBtn.setEnabled(false);
    this.pressBtn.setEnabled(false);
    this.repaintCards();
  }

  private repaintCards(): void {
    const views = this.game_.view();
    this.cards.forEach((card) => {
      const cv = views.find((x) => x.id === (card.getData("id") as string))!;
      this.paintCard(card, cv);
    });
  }

  private buildHeader(): void {
    const c = this.game_.case;
    this.add
      .text(GAME_WIDTH / 2, 34, "AGAIN", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.ink })
      .setOrigin(0.5)
      .setLetterSpacing(6);
    const leave = this.add
      .text(14, 16, "← leave", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    leave.on("pointerup", () => this.confirmLeave());
    this.add
      .text(GAME_WIDTH / 2, 66, `${c.title}  ·  ${c.subject}`, {
        fontFamily: DISPLAY,
        fontSize: "15px",
        color: CSS.amber,
        fontStyle: "italic",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 92, this.mode === "versus" ? "Two detectives, one room. Take turns. Most pins when it breaks wins." : this.mode === "coop" ? "Partners. One hard subject, two heads. Break it together." : this.mode === "daily" ? "Today's subject — the same one everyone gets, until midnight. Break it clean." : c.intro, {
        fontFamily: BODY,
        fontSize: "13px",
        color: CSS.muted,
        align: "center",
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5);
    this.hud = this.add
      .text(GAME_WIDTH / 2, 118, "", { fontFamily: MONO, fontSize: "12px", color: CSS.faint })
      .setOrigin(0.5);
    const ledgerLink = this.add
      .text(GAME_WIDTH - 14, 118, "≡ ledger", { fontFamily: MONO, fontSize: "11px", color: CSS.faint })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    ledgerLink.on("pointerup", () => this.showLedger());
    this.pressureBar = this.add.graphics();
    // A faint rule separating the header from the testimony.
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.panelEdge, 0.6);
    rule.fillRect(40, 144, GAME_WIDTH - 80, 1);
    if (this.mode === "versus") {
      this.turnBanner = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 8, "", { fontFamily: DISPLAY, fontSize: "15px", fontStyle: "italic" })
        .setOrigin(0.5, 1)
        .setDepth(95);
    }
  }

  // ---- versus turns ----------------------------------------------------------

  private playerColor(p: number): string {
    return p === 0 ? CSS.amber : CSS.slate;
  }

  private passTurn(): void {
    if (this.mode !== "versus") return;
    this.activePlayer = this.activePlayer === 0 ? 1 : 0;
    this.clearSelection();
    this.updateHud();
  }

  private buildControls(): void {
    this.status = this.add
      .text(GAME_WIDTH / 2, 752, "", {
        fontFamily: BODY,
        fontSize: "14px",
        color: CSS.muted,
        fontStyle: "italic",
        align: "center",
        wordWrap: { width: 448 },
      })
      .setOrigin(0.5);

    this.pressBtn = new Button(this, 84, 810, {
      w: 144,
      h: 50,
      label: "PRESS",
      accent: COLORS.amber,
      onClick: () => this.doPress(),
    }).setEnabled(false);

    this.pinBtn = new Button(this, 240, 810, {
      w: 144,
      h: 50,
      label: "PIN",
      accent: COLORS.crimson,
      onClick: () => this.doPin(),
    }).setEnabled(false);

    new Button(this, 396, 810, {
      w: 144,
      h: 50,
      label: "AGAIN",
      accent: COLORS.slate,
      onClick: () => this.doAgain(),
    });
  }

  // ---- rendering -------------------------------------------------------------

  private renderCards(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    const views = this.game_.view();

    let y = LIST_TOP;
    for (const v of views) {
      const card = this.makeCard(v, y);
      this.cards.push(card);
      y += (card.getData("h") as number) + 7;
    }
  }

  private makeCard(v: LineView, top: number): Phaser.GameObjects.Container {
    const txt = this.add.text(0, 0, v.text, {
      fontFamily: BODY,
      fontSize: "14px",
      color: v.pinned ? CSS.faint : CSS.ink,
      wordWrap: { width: WRAP },
      lineSpacing: 2,
    });
    let ev: Phaser.GameObjects.Text | undefined;
    if (v.evidence) {
      ev = this.add.text(0, 0, "⟐ " + v.evidence, {
        fontFamily: MONO,
        fontSize: "11px",
        color: CSS.crimsonBright,
        wordWrap: { width: WRAP },
        lineSpacing: 1,
      });
    }
    const h = ev ? txt.height + ev.height + 24 : Math.max(42, txt.height + 18);
    txt.setPosition(-WRAP / 2, -h / 2 + 10);
    ev?.setPosition(-WRAP / 2, -h / 2 + txt.height + 16);

    const bg = this.add.graphics();
    const marker = this.add.graphics();

    const children: Phaser.GameObjects.GameObject[] = [bg, marker, txt];
    if (ev) children.push(ev);
    const container = this.add.container(CARD_X, top + h / 2, children);
    container.setData("h", h);
    container.setData("id", v.id);
    container.setSize(CARD_W, h);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -h / 2, CARD_W, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on("pointerup", () => this.onCardTap(v.id));

    this.paintCard(container, v);

    // Flash if this line moved on the latest telling.
    if (v.changedNow) {
      txt.setColor(CSS.amber);
      if (!getReduceMotion())
        this.tweens.add({ targets: container, x: { from: CARD_X - 5, to: CARD_X }, duration: 90, yoyo: true, repeat: 1 });
      this.time.delayedCall(420, () => txt.setColor(v.pinned ? CSS.faint : CSS.ink));
    }
    return container;
  }

  private paintCard(container: Phaser.GameObjects.Container, v: LineView): void {
    const bg = container.list[0] as Phaser.GameObjects.Graphics;
    const marker = container.list[1] as Phaser.GameObjects.Graphics;
    const h = container.getData("h") as number;
    const sel = this.selected === v.id;

    bg.clear();
    // Subtle top-lit gradient gives the card a little depth under the lamp.
    const a = v.pinned ? 0.5 : 1;
    bg.fillStyle(COLORS.panel, a);
    bg.fillRoundedRect(-CARD_W / 2, -h / 2, CARD_W, h, 8);
    bg.fillGradientStyle(COLORS.panelEdge, COLORS.panelEdge, COLORS.panel, COLORS.panel, v.pinned ? 0.12 : 0.28);
    bg.fillRoundedRect(-CARD_W / 2, -h / 2, CARD_W, h, 8);
    const edge = sel ? COLORS.amber : v.pinned ? COLORS.crimson : COLORS.panelEdge;
    bg.lineStyle(sel ? 2 : 1.5, edge, 1);
    bg.strokeRoundedRect(-CARD_W / 2, -h / 2, CARD_W, h, 8);

    // Left marker: caught (amber) or pinned (crimson) — your ledger remembers.
    // A glyph backs up the color so the state reads without relying on hue.
    marker.clear();
    const gx = -CARD_W / 2 + 13;
    const gy = -h / 2 + 13;
    if (v.pinned) {
      marker.fillStyle(COLORS.crimson, 1);
      marker.fillRoundedRect(-CARD_W / 2, -h / 2, 4, h, 2);
      marker.lineStyle(1.6, COLORS.crimsonBright, 1); // ✕
      marker.lineBetween(gx - 3, gy - 3, gx + 3, gy + 3);
      marker.lineBetween(gx - 3, gy + 3, gx + 3, gy - 3);
    } else if (v.caught) {
      marker.fillStyle(COLORS.amber, 0.9);
      marker.fillRoundedRect(-CARD_W / 2, -h / 2, 4, h, 2);
      marker.fillStyle(COLORS.amber, 1); // ▲
      marker.fillTriangle(gx, gy - 4, gx - 4, gy + 3, gx + 4, gy + 3);
    }

    // Selected-line pointer on the right edge.
    if (sel) {
      marker.fillStyle(COLORS.amber, 1);
      marker.fillTriangle(CARD_W / 2 - 6, 0, CARD_W / 2 - 13, -5, CARD_W / 2 - 13, 5);
    }

    // Instability pips — how worked-loose a pressed line is, so PRESS reads.
    if (!v.pinned && v.pressed > 0) {
      const pips = Math.min(3, Math.ceil(v.pressed / 0.5));
      marker.fillStyle(COLORS.amber, 0.85);
      for (let i = 0; i < pips; i++) marker.fillCircle(CARD_W / 2 - 14 - i * 8, h / 2 - 9, 2);
    }
  }

  // ---- interaction -----------------------------------------------------------

  private onCardTap(id: string): void {
    if (this.busy) return;
    const v = this.game_.view().find((x) => x.id === id)!;
    if (v.pinned) return;
    this.selected = this.selected === id ? null : id;
    this.repaintCards();
    this.pinBtn.setEnabled(this.selected !== null);
    this.pressBtn.setEnabled(this.selected !== null);
    SFX.select();
  }

  private doPress(): void {
    if (this.busy || !this.selected) return;
    const r = this.game_.press(this.selected);
    this.updateHud();
    if (r.evidence) {
      SFX.pin();
      this.renderCards();
      this.setStatus("Proof. " + r.evidence, CSS.crimsonBright);
    } else if (r.deflate) {
      SFX.deny();
      this.setStatus(tell("deflate"), CSS.slate);
    } else {
      SFX.select();
      this.setStatus(tell(r.ok ? "pressUseful" : "pressBarren"), r.ok ? CSS.amber : CSS.muted);
    }
    this.repaintCards();
    this.passTurn();
  }

  private doAgain(): void {
    if (this.busy || this.game_.broken || this.game_.lost) return;
    SFX.again();
    const moved = this.game_.again();
    this.selected = null;
    this.pinBtn.setEnabled(false);
    this.pressBtn.setEnabled(false);
    this.renderCards();
    this.updateHud();
    if (this.game_.recovered) {
      SFX.deny();
      if (!getReduceMotion()) this.cameras.main.flash(220, 30, 26, 20);
      this.setStatus(tell("recovered"), CSS.slate);
    } else if (moved.length > 0) {
      SFX.flicker();
      this.setStatus(tell("againMoved"), CSS.amber);
      moved.forEach((id) => this.floatGhost(id, this.game_.previousText(id)));
    } else {
      this.setStatus(tell("againHeld"), CSS.muted);
    }
    this.passTurn();
  }

  /** A fading echo of what a line said a moment ago, so the change is legible. */
  private floatGhost(id: string, prev?: string): void {
    if (!prev) return;
    const card = this.cards.find((c) => (c.getData("id") as string) === id);
    if (!card) return;
    const h = card.getData("h") as number;
    const g = this.add
      .text(card.x - CARD_W / 2 + 12, card.y - h / 2 - 4, "a moment ago:  " + prev, {
        fontFamily: BODY,
        fontSize: "11px",
        color: CSS.faint,
        fontStyle: "italic",
        wordWrap: { width: WRAP },
      })
      .setOrigin(0, 1)
      .setDepth(40);
    this.tweens.add({ targets: g, y: g.y - 16, alpha: { from: 0.9, to: 0 }, duration: 1700, ease: "Cubic.easeOut", onComplete: () => g.destroy() });
  }

  private doPin(): void {
    if (this.busy || !this.selected) return;
    const id = this.selected;
    const res = this.game_.pin(id);
    switch (res.kind) {
      case "pinned":
        SFX.pin();
        this.lampFlicker();
        this.ledger.push(res.lines);
        if (this.mode === "versus") this.scores[this.activePlayer]++;
        this.setStatus(this.mode === "versus" ? `Player ${this.activePlayer + 1} pins it.` : tell("pinned"), CSS.crimsonBright);
        this.selected = null;
        this.pinBtn.setEnabled(false);
        this.pressBtn.setEnabled(false);
        this.renderCards();
        this.updateHud();
        if (res.broke) this.time.delayedCall(600, () => this.breakStory());
        else this.passTurn();
        break;
      case "not-yet":
        SFX.deny();
        this.setStatus(tell("notYet"), CSS.muted);
        this.passTurn();
        break;
      case "false":
        SFX.wrong();
        if (!getReduceMotion()) this.cameras.main.shake(160, 0.004);
        this.lastStriker = this.activePlayer;
        this.setStatus(res.out ? "That was the truth. It's done talking." : tell("falseStrike"), CSS.slate);
        this.updateHud();
        if (res.out) this.time.delayedCall(700, () => this.endLost());
        else this.passTurn();
        break;
      case "already":
        break;
    }
  }

  // ---- state / endings -------------------------------------------------------

  private updateHud(): void {
    const g = this.game_;
    const strikes =
      "●".repeat(g.strikesUsed) + "○".repeat(Math.max(0, g.case.strikes - g.strikesUsed));
    if (this.mode === "versus") {
      this.hud.setText(`P1 ●${this.scores[0]}    ·    P2 ●${this.scores[1]}    ·    ${g.pinsDone}/${g.case.pinsToBreak}    ·    ${strikes}`);
      if (this.turnBanner) {
        this.turnBanner
          .setText(`▲  Player ${this.activePlayer + 1} to act  ▲`)
          .setColor(this.playerColor(this.activePlayer));
      }
    } else {
      this.hud.setText(`telling ${g.telling}    ·    pinned ${g.pinsDone}/${g.case.pinsToBreak}    ·    ${strikes}`);
    }

    // Pressure bar — composure giving way. Reddens as it climbs.
    const bw = 300;
    const x = (GAME_WIDTH - bw) / 2;
    const y = 134;
    const col = g.state === "HIGH" ? COLORS.crimson : g.state === "MEDIUM" ? COLORS.amber : COLORS.slate;
    this.pressureBar.clear();
    this.pressureBar.fillStyle(COLORS.panel, 1);
    this.pressureBar.fillRoundedRect(x, y, bw, 4, 2);
    this.pressureBar.fillStyle(col, 1);
    this.pressureBar.fillRoundedRect(x, y, (bw * g.pressure) / 100, 4, 2);

    // The lamp breathes with the pressure in the room.
    if (this.lamp) {
      const t = g.pressure / 100;
      this.lamp.setAlpha(0.85 + 0.15 * t);
      this.lamp.setScale(1 + 0.12 * t);
      this.lamp.setTint(g.state === "HIGH" ? 0xffb38f : g.state === "MEDIUM" ? 0xffe0b8 : 0xffffff);
    }

    // Tension vignette + a single heartbeat the moment the room tips into HIGH.
    if (this.tension) {
      const target = g.state === "HIGH" ? 0.36 : g.state === "MEDIUM" ? 0.12 : 0;
      if (getReduceMotion()) this.tension.setAlpha(target);
      else this.tweens.add({ targets: this.tension, alpha: target, duration: 300 });
    }
    const high = g.state === "HIGH";
    if (high && !this.prevHigh) SFX.heart();
    this.prevHigh = high;
  }

  private lampFlicker(): void {
    if (!this.lamp || getReduceMotion()) return;
    const a = this.lamp.alpha;
    this.tweens.add({ targets: this.lamp, alpha: a * 0.4, duration: 60, yoyo: true, repeat: 1 });
  }

  private setStatus(msg: string, color: string): void {
    this.status.setText(msg).setColor(color);
  }

  private breakStory(): void {
    this.busy = true;
    incBreaks();
    if (this.mode === "story") markCleared(this.caseIndex + 1);
    SFX.break();

    const g = this.game_;
    const id = g.case.id;
    const prevBest = getBest(id);
    setBest(id, g.telling);
    const best = getBest(id) ?? g.telling;
    const par = g.case.pinsToBreak * 2 + 1;
    const isClean = g.strikesUsed === 0 && g.telling <= par;
    if (isClean && (this.mode === "story" || this.mode === "daily")) markCleanCase(id);
    const verdict = isClean ? "a clean break" : g.telling <= par + 4 ? "it broke" : "it broke, eventually";
    const fresh = prevBest === null || g.telling < prevBest ? "   ⟐ new best" : "";
    const stats = `${verdict}\ntold again ${g.telling}×  ·  ${g.strikesUsed} strike${g.strikesUsed === 1 ? "" : "s"}  ·  best ${best}×${fresh}`;

    const ledger = this.ledger.map((p) => "“" + p.join("”\n   …  “") + "”").join("\n\n");

    if (this.mode === "versus") {
      const [a, b] = this.scores;
      const winner = a === b ? this.activePlayer : a > b ? 0 : 1; // tie → the one who landed the break
      this.showOverlay({
        heading: `Player ${winner + 1} wins`,
        headColor: this.playerColor(winner),
        stats: `Player 1 ●${a}      Player 2 ●${b}\nthe one who pinned more, before it broke`,
        ledger,
        body: g.case.resolution,
        button: { label: "AGAIN, NEW SUBJECT", onClick: () => this.scene.restart({ mode: "versus" }) },
      });
      return;
    }

    if (this.mode === "daily") {
      this.showOverlay({
        heading: "today, broken",
        headColor: CSS.amber,
        stats,
        ledger,
        body: g.case.resolution,
        share: `AGAIN — ${todayStamp()}\nbroke it in ${g.telling}× · ${g.strikesUsed}✕`,
        button: { label: "TRY TODAY AGAIN", onClick: () => this.scene.restart({ mode: "daily" }) },
      });
      return;
    }

    if (this.mode === "coop") {
      this.showOverlay({
        heading: "you break it",
        headColor: CSS.amber,
        stats: `together  ·  told again ${g.telling}×  ·  ${g.strikesUsed} strike${g.strikesUsed === 1 ? "" : "s"}`,
        ledger,
        body: g.case.resolution,
        button: { label: "ANOTHER, TOGETHER", onClick: () => this.scene.restart({ mode: "coop" }) },
      });
      return;
    }

    if (this.mode === "endless") {
      const night = this.depth + 1;
      markDeepest(night);
      this.showOverlay({
        heading: "it breaks",
        headColor: CSS.amber,
        stats: `night ${night} broken  ·  told again ${g.telling}×  ·  ${g.strikesUsed} strike${g.strikesUsed === 1 ? "" : "s"}\nthe next one will be harder`,
        ledger,
        body: g.case.resolution,
        button: { label: "ONE MORE", onClick: () => this.scene.restart({ mode: "endless", depth: this.depth + 1 }) },
      });
      return;
    }

    const hasNext = this.caseIndex + 1 < CASES.length;
    this.showOverlay({
      heading: "the story breaks",
      headColor: CSS.amber,
      stats,
      ledger,
      body: g.case.resolution,
      button: hasNext
        ? { label: "THE NEXT ONE", onClick: () => this.scene.restart({ caseIndex: this.caseIndex + 1 }) }
        : { label: "THAT'S ALL OF THEM", onClick: () => this.scene.start("TitleScene") },
    });
  }

  private endLost(): void {
    this.busy = true;
    if (this.mode === "versus") {
      const loser = this.lastStriker;
      const winner = loser === 0 ? 1 : 0;
      this.showOverlay({
        heading: `Player ${winner + 1} wins`,
        headColor: this.playerColor(winner),
        stats: `Player ${loser + 1} accused the truth once too often.\nthe subject walks — the steadier hand takes it`,
        body: "They stand and leave. In the end it wasn't about who pinned the most. It was about who blinked.",
        button: { label: "AGAIN, NEW SUBJECT", onClick: () => this.scene.restart({ mode: "versus" }) },
      });
      return;
    }
    if (this.mode === "endless") {
      const reached = this.depth + 1;
      markDeepest(this.depth); // nights fully broken before this one
      this.showOverlay({
        heading: "they walk",
        headColor: CSS.slate,
        stats: `you broke ${this.depth} night${this.depth === 1 ? "" : "s"}  ·  deepest ${getDeepest()}\nnight ${reached} kept its shape`,
        body: "They stand, and leave. The chair is cold before the door closes.\n\nYou accused the truth one too many times, and the night that would have held went slack in your hands.",
        button: { label: "FROM THE FIRST NIGHT", onClick: () => this.scene.start("TitleScene") },
      });
      return;
    }
    if (this.mode === "coop") {
      this.showOverlay({
        heading: "they walk",
        headColor: CSS.slate,
        body: "They stand, and leave. Between the two of you, the truth got accused one time too many, and the night went slack.",
        button: { label: "AGAIN, TOGETHER", onClick: () => this.scene.restart({ mode: "coop" }) },
      });
      return;
    }
    if (this.mode === "daily") {
      this.showOverlay({
        heading: "they walk",
        headColor: CSS.slate,
        body: "They stand, and leave. Today's subject keeps its secret — at least until you sit down with it again.",
        share: `AGAIN — ${todayStamp()}\nthey walked · didn't break today`,
        button: { label: "TRY TODAY AGAIN", onClick: () => this.scene.restart({ mode: "daily" }) },
      });
      return;
    }
    this.showOverlay({
      heading: "they walk",
      headColor: CSS.slate,
      body: "They stand, and leave.\n\nYou pressed where there was nothing to give, and the one thread that would have held went slack. Some nights keep their shape no matter how often you ask.",
      button: { label: "AGAIN", onClick: () => this.scene.restart({ caseIndex: this.caseIndex }) },
    });
  }

  private showOverlay(opts: {
    heading: string;
    headColor: string;
    body: string;
    stats?: string;
    ledger?: string;
    share?: string;
    button: { label: string; onClick: () => void };
  }): void {
    this.overlayAction = opts.button.onClick;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.95);
    c.add(dim);
    // Keep the room's texture over the end screen rather than flat black.
    if (this.textures.exists("grain")) c.add(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setAlpha(0.5));
    if (this.textures.exists("vignette")) c.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));

    // A case-file stamp, slapped at an angle.
    const walked = opts.heading.toLowerCase().includes("walk");
    const stampText = walked ? "WALKED" : "CLOSED";
    const stampColor = walked ? COLORS.slate : COLORS.crimson;
    const stamp = this.add
      .text(GAME_WIDTH - 78, 120, stampText, { fontFamily: DISPLAY, fontSize: "22px", color: walked ? CSS.slate : CSS.crimsonBright, fontStyle: "bold" })
      .setOrigin(0.5)
      .setRotation(-0.22)
      .setAlpha(0.9);
    const box = this.add
      .rectangle(GAME_WIDTH - 78, 120, stamp.width + 18, stamp.height + 8)
      .setStrokeStyle(2.5, stampColor, 0.9)
      .setRotation(-0.22);
    c.add([box, stamp]);
    if (getReduceMotion()) {
      stamp.setAlpha(0.9);
      box.setAlpha(0.9);
    } else {
      stamp.setScale(2).setAlpha(0);
      box.setScale(2).setAlpha(0);
      this.tweens.add({ targets: [stamp, box], scale: 1, alpha: 0.9, duration: 220, ease: "Back.easeIn" });
    }

    let y = 150;
    const head = this.add
      .text(GAME_WIDTH / 2, y, opts.heading, { fontFamily: DISPLAY, fontSize: "26px", color: opts.headColor, fontStyle: "italic" })
      .setOrigin(0.5, 0);
    c.add(head);
    y += head.height + 12;

    const rule = this.add.graphics();
    rule.fillStyle(opts.headColor === CSS.slate ? COLORS.slate : COLORS.amber, 0.7);
    rule.fillRect(GAME_WIDTH / 2 - 55, y, 110, 1);
    c.add(rule);
    y += 14;

    if (opts.stats) {
      const st = this.add
        .text(GAME_WIDTH / 2, y, opts.stats, {
          fontFamily: MONO,
          fontSize: "12px",
          color: CSS.slate,
          align: "center",
          lineSpacing: 3,
        })
        .setOrigin(0.5, 0);
      c.add(st);
      y += st.height + 16;
    }

    if (opts.ledger) {
      const led = this.add
        .text(GAME_WIDTH / 2, y, opts.ledger, {
          fontFamily: MONO,
          fontSize: "12px",
          color: CSS.amber,
          align: "left",
          wordWrap: { width: 396 },
          lineSpacing: 3,
        })
        .setOrigin(0.5, 0);
      c.add(led);
      y += led.height + 22;
    }

    const text = this.add
      .text(GAME_WIDTH / 2, y, opts.body, {
        fontFamily: BODY,
        fontSize: "15px",
        color: CSS.ink,
        align: "left",
        wordWrap: { width: 400 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    c.add(text);

    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 600 });

    if (getNarration()) this.time.delayedCall(500, () => speak(`${opts.heading}. ${opts.body}`));

    const btn = new Button(this, GAME_WIDTH / 2, opts.share ? 798 : 812, {
      w: 260,
      h: 50,
      label: opts.button.label,
      accent: COLORS.slate,
      onClick: opts.button.onClick,
    });
    c.add(btn);

    if (opts.share) {
      const copy = this.add
        .text(GAME_WIDTH / 2, 836, "⧉  copy result", { fontFamily: MONO, fontSize: "12px", color: CSS.faint })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      copy.on("pointerup", () => {
        try {
          void navigator.clipboard?.writeText(opts.share!);
          copy.setText("✓  copied").setColor(CSS.amber);
        } catch {
          copy.setText("clipboard blocked").setColor(CSS.slate);
        }
      });
      c.add(copy);
    }
  }
}
