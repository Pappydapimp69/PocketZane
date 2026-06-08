import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { Inquiry } from "../game/deduction";
import { WELLS_STREET } from "../game/cases2";
import { SFX, startAmbience, stopSpeech } from "../game/audio";
import { addAtmosphere } from "../game/textures";
import { PAD } from "../input";

const LEFT = 28;
const RIGHT = GAME_WIDTH - 28;
const TOP = 162;
const FONT = 16;
const LINE_H = 28;

interface ClauseLayout {
  id: string;
  broken: boolean;
  words: Phaser.GameObjects.Text[];
  runs: { x0: number; x1: number; top: number; bottom: number }[];
}

/** The redesigned loop: a real case, a cover story that rewrites under evidence. */
export class InterrogationScene extends Phaser.Scene {
  private inq!: Inquiry;
  private selected: string | null = null;
  private clauses: ClauseLayout[] = [];
  private marks!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private busy = false;
  private overlayClose: (() => void) | null = null;
  private spaceW = 6;
  private spaceMeasured = false;

  constructor() {
    super("Interrogation");
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(360);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });
    startAmbience();

    this.inq = new Inquiry(WELLS_STREET);
    this.selected = null;
    this.busy = false;
    this.marks = this.add.graphics().setDepth(5);

    this.buildHeader();
    this.buildControls();
    this.renderTestimony();
    this.updateHud();
    this.setupInput();

    this.showFile(true); // open the case file first
  }

  // ---- header / controls -----------------------------------------------------

  private buildHeader(): void {
    const c = this.inq.case;
    this.add.text(GAME_WIDTH / 2, 34, "AGAIN", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.ink }).setOrigin(0.5).setLetterSpacing(6);
    const leave = this.add.text(14, 16, "← leave", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    leave.on("pointerup", () => this.scene.start("TitleScene"));
    this.add.text(GAME_WIDTH / 2, 66, c.title, { fontFamily: DISPLAY, fontSize: "16px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 90, c.subject, { fontFamily: BODY, fontSize: "13px", color: CSS.muted }).setOrigin(0.5);
    this.hud = this.add.text(GAME_WIDTH / 2, 116, "", { fontFamily: MONO, fontSize: "12px", color: CSS.faint }).setOrigin(0.5);
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.panelEdge, 0.6);
    rule.fillRect(40, 140, GAME_WIDTH - 80, 1);
  }

  private buildControls(): void {
    this.status = this.add
      .text(GAME_WIDTH / 2, 748, "", { fontFamily: BODY, fontSize: "14px", color: CSS.muted, fontStyle: "italic", align: "center", wordWrap: { width: 444 } })
      .setOrigin(0.5);
    new Button(this, 84, 810, { w: 144, h: 50, label: "QUESTION  A", fontSize: 12, accent: COLORS.slate, onClick: () => this.doQuestion() });
    new Button(this, 240, 810, { w: 144, h: 50, label: "PRESENT  X", fontSize: 12, accent: COLORS.crimson, onClick: () => this.doPresent() });
    new Button(this, 396, 810, { w: 144, h: 50, label: "THE FILE  Y", fontSize: 12, accent: COLORS.amber, onClick: () => this.showFile(false) });
  }

  private updateHud(): void {
    this.hud.setText(`cornered ${this.inq.brokenCount}/${this.inq.total}    ·    evidence ${this.inq.heldEvidence().length}`);
  }

  private setStatus(msg: string, color: string = CSS.muted): void {
    this.status.setText(msg).setColor(color);
  }

  // ---- input -----------------------------------------------------------------

  private setupInput(): void {
    const kb = this.input.keyboard;
    kb?.on("keydown-UP", () => this.onPad(PAD.UP));
    kb?.on("keydown-DOWN", () => this.onPad(PAD.DOWN));
    kb?.on("keydown-ENTER", () => this.onPad(PAD.A));
    kb?.on("keydown-SPACE", () => this.onPad(PAD.A));
    kb?.on("keydown-X", () => this.onPad(PAD.X));
    kb?.on("keydown-Y", () => this.onPad(PAD.Y));
    kb?.on("keydown-F", () => this.scale.toggleFullscreen());
    this.input.gamepad?.on("down", (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => this.onPad(b.index));
  }

  private onPad(i: number): void {
    if (this.busy) {
      if (this.pickHandler) {
        this.pickHandler(i);
        return;
      }
      if ((i === PAD.A || i === PAD.B || i === PAD.START) && this.overlayClose) this.overlayClose();
      return;
    }
    if (i === PAD.UP) this.moveSelection(-1);
    else if (i === PAD.DOWN) this.moveSelection(1);
    else if (i === PAD.A) this.doQuestion();
    else if (i === PAD.X || i === PAD.LT) this.doPresent();
    else if (i === PAD.Y) this.showFile(false);
  }

  private selectableIds(): string[] {
    return this.inq.threads().filter((t) => !t.broken).map((t) => t.id);
  }

  private moveSelection(dir: number): void {
    const ids = this.selectableIds();
    if (ids.length === 0) return;
    const cur = this.selected ? ids.indexOf(this.selected) : -1;
    const next = cur < 0 ? (dir > 0 ? 0 : ids.length - 1) : Phaser.Math.Wrap(cur + dir, 0, ids.length);
    this.selected = ids[next];
    this.drawMarks();
    SFX.select();
  }

  // ---- testimony rendering ---------------------------------------------------

  private measureSpace(): void {
    if (this.spaceMeasured) return;
    const a = this.add.text(0, 0, "n n", { fontFamily: BODY, fontSize: `${FONT}px` });
    const b = this.add.text(0, 0, "nn", { fontFamily: BODY, fontSize: `${FONT}px` });
    this.spaceW = Math.max(3, a.width - b.width);
    a.destroy();
    b.destroy();
    this.spaceMeasured = true;
  }

  private renderTestimony(): void {
    this.measureSpace();
    this.clauses.forEach((c) => c.words.forEach((w) => w.destroy()));
    this.clauses = [];
    let x = LEFT;
    let y = TOP;
    for (const t of this.inq.threads()) {
      const words = t.claim.split(/\s+/).filter(Boolean);
      const objs: Phaser.GameObjects.Text[] = [];
      const runs: ClauseLayout["runs"] = [];
      let run: ClauseLayout["runs"][number] | null = null;
      for (const w of words) {
        const txt = this.add.text(0, 0, w, { fontFamily: BODY, fontSize: `${FONT}px`, color: t.broken ? CSS.faint : CSS.ink }).setDepth(6);
        if (x + txt.width > RIGHT && x > LEFT) {
          x = LEFT;
          y += LINE_H;
          run = null;
        }
        txt.setPosition(x, y);
        txt.setInteractive({ useHandCursor: true });
        txt.on("pointerup", () => this.onClauseTap(t.id));
        objs.push(txt);
        if (!run || run.top !== y) {
          run = { x0: x, x1: x + txt.width, top: y, bottom: y + txt.height };
          runs.push(run);
        } else run.x1 = x + txt.width;
        x += txt.width + this.spaceW;
      }
      x += this.spaceW;
      this.clauses.push({ id: t.id, broken: t.broken, words: objs, runs });
    }
    this.drawMarks();
  }

  private drawMarks(): void {
    const g = this.marks;
    g.clear();
    const fontH = FONT + 4;
    for (const cl of this.clauses) {
      if (this.selected === cl.id && !cl.broken) {
        g.fillStyle(COLORS.amber, 0.16);
        for (const r of cl.runs) g.fillRoundedRect(r.x0 - 4, r.top - 2, r.x1 - r.x0 + 8, fontH + 6, 4);
      }
      if (cl.broken) {
        g.lineStyle(1.6, COLORS.crimson, 0.95);
        for (const r of cl.runs) g.lineBetween(r.x0, r.top + fontH / 2, r.x1, r.top + fontH / 2);
      }
    }
  }

  private onClauseTap(id: string): void {
    if (this.busy) return;
    const t = this.inq.threads().find((x) => x.id === id)!;
    if (t.broken) return;
    this.selected = this.selected === id ? null : id;
    this.drawMarks();
    SFX.select();
  }

  // ---- verbs -----------------------------------------------------------------

  private doQuestion(): void {
    if (this.busy) return;
    if (!this.selected) {
      this.setStatus("Pick a line of his story first, then question it.", CSS.muted);
      return;
    }
    const res = this.inq.question(this.selected);
    if (!res) {
      this.setStatus("Nothing more to ask there.", CSS.muted);
      return;
    }
    SFX.again();
    this.setStatus(`"${res.reply}"`, CSS.ink);
    if (res.gained.length) {
      this.updateHud();
      this.time.delayedCall(900, () => this.centerToast("New evidence:  " + res.gained.map((e) => e.label).join("  ·  ")));
    }
  }

  private doPresent(): void {
    if (this.busy) return;
    if (!this.selected) {
      this.setStatus("Select the claim you want to break, then present.", CSS.muted);
      return;
    }
    const held = this.inq.heldEvidence();
    if (held.length === 0) {
      this.setStatus("Your file is empty. Question him to turn something up.", CSS.muted);
      return;
    }
    this.showPicker();
  }

  private presentEvidence(evId: string): void {
    const threadId = this.selected!;
    const res = this.inq.present(threadId, evId);
    switch (res.kind) {
      case "forced":
        SFX.pin();
        this.renderTestimony();
        this.setStatus("His story bends to fit it. Something new to lean on now.", CSS.amber);
        break;
      case "broke":
        SFX.pin();
        this.renderTestimony();
        this.selected = null;
        if (res.solved) {
          this.setStatus("That one can't stand. The case holds together now.", CSS.crimsonBright);
          this.time.delayedCall(900, () => this.solve());
        } else {
          this.setStatus("That thread snaps. Keep pulling.", CSS.crimsonBright);
        }
        this.updateHud();
        break;
      case "nomatch":
        SFX.deny();
        this.setStatus("He doesn't flinch. That doesn't touch this claim — not yet.", CSS.slate);
        break;
      case "already":
        break;
    }
  }

  // ---- overlays --------------------------------------------------------------

  private centerToast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, 700, msg, { fontFamily: MONO, fontSize: "12px", color: CSS.amber, align: "center", wordWrap: { width: 440 } }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: 2200, duration: 700, onComplete: () => t.destroy() });
  }

  private showFile(initial: boolean): void {
    const c = this.inq.case;
    this.busy = true;
    const o = this.add.container(0, 0).setDepth(120);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    if (this.textures.exists("vignette")) o.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    o.add(this.add.text(GAME_WIDTH / 2, 70, "the file", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    const body = `${c.brief.what}\n\n${c.brief.where}  ${c.brief.when}\n\n${c.brief.why}\n\n— ${c.brief.goal}`;
    o.add(this.add.text(GAME_WIDTH / 2, 110, body, { fontFamily: BODY, fontSize: "15px", color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));

    const ev = this.inq.heldEvidence();
    const evText = ev.length ? "in your file:\n" + ev.map((e) => "•  " + e.label).join("\n") : "in your file: nothing yet — question him.";
    const evY = 110 + 330;
    o.add(this.add.text(GAME_WIDTH / 2, evY, evText, { fontFamily: MONO, fontSize: "12px", color: CSS.muted, align: "left", wordWrap: { width: 408 }, lineSpacing: 4 }).setOrigin(0.5, 0));

    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
    };
    this.overlayClose = close;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 72, { w: 220, h: 50, label: initial ? "BEGIN  (A)" : "CLOSE  (A)", accent: COLORS.crimson, onClick: close }));
  }

  private showPicker(): void {
    this.busy = true;
    const held = this.inq.heldEvidence();
    const o = this.add.container(0, 0).setDepth(120);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    o.add(this.add.text(GAME_WIDTH / 2, 90, "present what?", { fontFamily: DISPLAY, fontSize: "24px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    const topic = this.inq.threads().find((t) => t.id === this.selected)?.topic ?? "";
    o.add(this.add.text(GAME_WIDTH / 2, 120, `against: ${topic}`, { fontFamily: MONO, fontSize: "12px", color: CSS.muted }).setOrigin(0.5));

    const rows: Button[] = [];
    let y = 170;
    held.forEach((e) => {
      const b = new Button(this, GAME_WIDTH / 2, y, { w: 430, h: 46, label: e.label, fontSize: 12, accent: COLORS.slate, onClick: () => choose(e.id) });
      rows.push(b);
      o.add(b);
      y += 54;
    });
    const cancelBtn = new Button(this, GAME_WIDTH / 2, Math.min(y + 8, GAME_HEIGHT - 60), { w: 180, h: 46, label: "CANCEL  (B)", accent: COLORS.crimson, onClick: () => close() });
    o.add(cancelBtn);

    let focus = 0;
    const items = [...rows, cancelBtn];
    const paint = () => items.forEach((b, idx) => b.setActive2(idx === focus));
    paint();
    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
      this.pickHandler = null;
    };
    const choose = (evId: string) => {
      close();
      this.presentEvidence(evId);
    };
    this.overlayClose = close;
    this.pickHandler = (i: number) => {
      if (i === PAD.UP) {
        focus = Phaser.Math.Wrap(focus - 1, 0, items.length);
        paint();
        SFX.select();
      } else if (i === PAD.DOWN) {
        focus = Phaser.Math.Wrap(focus + 1, 0, items.length);
        paint();
        SFX.select();
      } else if (i === PAD.A) {
        if (focus < rows.length) choose(held[focus].id);
        else close();
      } else if (i === PAD.B) close();
    };
  }

  private pickHandler: ((i: number) => void) | null = null;

  private solve(): void {
    this.busy = true;
    const o = this.add.container(0, 0).setDepth(140);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.97));
    if (this.textures.exists("grain")) o.add(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setAlpha(0.5));
    if (this.textures.exists("vignette")) o.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    o.add(this.add.text(GAME_WIDTH / 2, 110, "the story breaks", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    o.add(this.add.text(GAME_WIDTH / 2, 160, this.inq.case.resolution, { fontFamily: BODY, fontSize: "15px", color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));
    SFX.break();
    const back = () => this.scene.start("TitleScene");
    this.overlayClose = back;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, { w: 220, h: 50, label: "CLOSE THE FILE  (A)", accent: COLORS.crimson, onClick: back }));
  }
}
