import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { MergedInquiry, PHASE_STRIKES } from "../game/merged";
import { WELLS } from "../game/mergedcase";
import { SFX, startAmbience, stopSpeech } from "../game/audio";
import { addAtmosphere } from "../game/textures";
import { PAD } from "../input";

const LEFT = 30;
const WRAP = GAME_WIDTH - 60;
const FONT = 16;
const LINE_H = 28;
const PTOP = 190;

interface ClauseLayout {
  id: string;
  struck: boolean;
  words: Phaser.GameObjects.Text[];
  runs: { x0: number; x1: number; top: number; bottom: number }[];
}

/** The merged loop: question phases → constraint-web confrontation. */
export class CaseRunScene extends Phaser.Scene {
  private inq!: MergedInquiry;
  private title!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private btnL!: Button;
  private btnR!: Button;

  // phase render
  private clauses: ClauseLayout[] = [];
  private marks!: Phaser.GameObjects.Graphics;
  private selected: string | null = null;
  private spaceW = 6;
  private spaceMeasured = false;
  // confront render
  private blocks: Phaser.GameObjects.GameObject[] = [];

  private busy = false;
  private overlayClose: (() => void) | null = null;
  private pickHandler: ((i: number) => void) | null = null;

  constructor() {
    super("CaseRun");
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(360);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });
    startAmbience();
    this.inq = new MergedInquiry(WELLS, (Date.now() & 0xffff) + 1);
    this.marks = this.add.graphics().setDepth(5);
    this.busy = false;

    const c = this.inq.case;
    this.add.text(GAME_WIDTH / 2, 30, "AGAIN", { fontFamily: DISPLAY, fontSize: "22px", color: CSS.ink }).setOrigin(0.5).setLetterSpacing(6);
    this.add.text(14, 14, "← leave", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.scene.start("TitleScene"));
    this.add.text(GAME_WIDTH - 14, 14, "the file  (Y)", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showFile(false));
    this.add.text(GAME_WIDTH / 2, 58, c.title, { fontFamily: DISPLAY, fontSize: "14px", color: CSS.muted, fontStyle: "italic" }).setOrigin(0.5);
    this.title = this.add.text(GAME_WIDTH / 2, 86, "", { fontFamily: DISPLAY, fontSize: "18px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5);
    this.hud = this.add.text(GAME_WIDTH / 2, 112, "", { fontFamily: MONO, fontSize: "12px", color: CSS.faint }).setOrigin(0.5);
    this.prompt = this.add.text(GAME_WIDTH / 2, 144, "", { fontFamily: BODY, fontSize: "13px", color: CSS.muted, align: "center", wordWrap: { width: 430 } }).setOrigin(0.5);
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.panelEdge, 0.6);
    rule.fillRect(40, 170, GAME_WIDTH - 80, 1);

    this.status = this.add.text(GAME_WIDTH / 2, 748, "", { fontFamily: BODY, fontSize: "14px", color: CSS.muted, fontStyle: "italic", align: "center", wordWrap: { width: 444 } }).setOrigin(0.5);
    this.btnL = new Button(this, 116, 810, { w: 200, h: 50, label: "", fontSize: 13, accent: COLORS.slate, onClick: () => this.actL() });
    this.btnR = new Button(this, 332, 810, { w: 200, h: 50, label: "", fontSize: 13, accent: COLORS.crimson, onClick: () => this.actR() });

    this.setupInput();
    this.enterMode();
    this.showFile(true);
  }

  private enterMode(): void {
    this.selected = null;
    this.marks.clear();
    this.clauses.forEach((c) => c.words.forEach((w) => w.destroy()));
    this.clauses = [];
    this.blocks.forEach((b) => b.destroy());
    this.blocks = [];
    if (this.inq.confronting) {
      this.title.setText("The Confrontation");
      this.prompt.setText("He gives it to you whole now. A head-on hit will deflect — find what's propping each lie up.");
      this.btnL.setLabel("PRESS HIM  (A)");
      this.btnR.setLabel("THE FILE  (X)");
      this.renderWeb();
    } else {
      this.title.setText(this.inq.phase.title);
      this.prompt.setText(this.inq.phase.prompt);
      this.btnL.setLabel("QUESTION  (A)");
      this.btnR.setLabel("PIN  (X)");
      this.renderPhase();
    }
    this.updateHud();
    this.setStatus("");
  }

  private updateHud(): void {
    if (this.inq.confronting) {
      this.hud.setText(`alibi  ${this.inq.brokenCount}/${this.inq.total} broken    ·    leads ${this.inq.heldEvidence().length}`);
    } else {
      const s = this.inq.phaseStrikes;
      const dots = "●".repeat(s) + "○".repeat(Math.max(0, PHASE_STRIKES - s));
      this.hud.setText(`patience ${dots}    ·    leads ${this.inq.leadCount}`);
    }
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
      if ((i === PAD.A || i === PAD.B || i === PAD.START || i === PAD.Y) && this.overlayClose) this.overlayClose();
      return;
    }
    if (this.inq.confronting) {
      if (i === PAD.A || i === PAD.LT) this.doPresent();
      else if (i === PAD.X || i === PAD.Y) this.showFile(false);
      return;
    }
    if (i === PAD.UP) this.moveSelection(-1);
    else if (i === PAD.DOWN) this.moveSelection(1);
    else if (i === PAD.A) this.doQuestion();
    else if (i === PAD.X || i === PAD.LT) this.doPin();
    else if (i === PAD.Y) this.showFile(false);
  }
  private actL(): void {
    if (this.inq.confronting) this.doPresent();
    else this.doQuestion();
  }
  private actR(): void {
    if (this.inq.confronting) this.showFile(false);
    else this.doPin();
  }

  // ---- phase: flowing testimony ----------------------------------------------

  private measureSpace(): void {
    if (this.spaceMeasured) return;
    const a = this.add.text(0, 0, "n n", { fontFamily: BODY, fontSize: `${FONT}px` });
    const b = this.add.text(0, 0, "nn", { fontFamily: BODY, fontSize: `${FONT}px` });
    this.spaceW = Math.max(3, a.width - b.width);
    a.destroy();
    b.destroy();
    this.spaceMeasured = true;
  }

  private renderPhase(): void {
    this.measureSpace();
    this.clauses.forEach((c) => c.words.forEach((w) => w.destroy()));
    this.clauses = [];
    let x = LEFT;
    let y = PTOP;
    for (const l of this.inq.phaseLines()) {
      const objs: Phaser.GameObjects.Text[] = [];
      const runs: ClauseLayout["runs"] = [];
      let run: ClauseLayout["runs"][number] | null = null;
      for (const w of l.text.split(/\s+/).filter(Boolean)) {
        const t = this.add.text(0, 0, w, { fontFamily: BODY, fontSize: `${FONT}px`, color: l.pinned ? CSS.faint : CSS.ink }).setDepth(6);
        if (x + t.width > GAME_WIDTH - 28 && x > LEFT) {
          x = LEFT;
          y += LINE_H;
          run = null;
        }
        t.setPosition(x, y);
        t.setInteractive({ useHandCursor: true });
        t.on("pointerup", () => this.onClauseTap(l.id));
        objs.push(t);
        if (!run || run.top !== y) {
          run = { x0: x, x1: x + t.width, top: y, bottom: y + t.height };
          runs.push(run);
        } else run.x1 = x + t.width;
        x += t.width + this.spaceW;
      }
      x += this.spaceW;
      this.clauses.push({ id: l.id, struck: l.pinned, words: objs, runs });
    }
    this.drawMarks();
  }

  private drawMarks(): void {
    const g = this.marks;
    g.clear();
    const fontH = FONT + 4;
    for (const cl of this.clauses) {
      if (this.selected === cl.id && !cl.struck) {
        g.fillStyle(COLORS.amber, 0.16);
        for (const r of cl.runs) g.fillRoundedRect(r.x0 - 4, r.top - 2, r.x1 - r.x0 + 8, fontH + 6, 4);
      }
      if (cl.struck) {
        g.lineStyle(1.6, COLORS.crimson, 0.95);
        for (const r of cl.runs) g.lineBetween(r.x0, r.top + fontH / 2, r.x1, r.top + fontH / 2);
      }
    }
  }

  private selectableIds(): string[] {
    return this.inq.phaseLines().filter((l) => !l.pinned).map((l) => l.id);
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
  private onClauseTap(id: string): void {
    if (this.busy || this.inq.confronting) return;
    const l = this.inq.phaseLines().find((x) => x.id === id);
    if (!l || l.pinned) return;
    this.selected = this.selected === id ? null : id;
    this.drawMarks();
    SFX.select();
  }

  private doQuestion(): void {
    if (this.busy) return;
    if (!this.selected) {
      this.setStatus("Pick a line of his account, then question it.", CSS.muted);
      return;
    }
    if (this.inq.question(this.selected).shifted) {
      SFX.flicker();
      this.renderPhase();
      this.setStatus("Something in it moves.", CSS.amber);
    } else {
      SFX.again();
      this.setStatus("He says it the same way. Unmoved.", CSS.muted);
    }
  }

  private doPin(): void {
    if (this.busy) return;
    if (!this.selected) {
      this.setStatus("Select the line you mean to call a lie.", CSS.muted);
      return;
    }
    const r = this.inq.pin(this.selected);
    switch (r.kind) {
      case "lead":
        SFX.pin();
        this.renderPhase();
        this.updateHud();
        this.setStatus("Caught. That's a lead.", CSS.crimsonBright);
        this.centerToast("New lead:  " + this.inq.leadLabel(r.leadId));
        if (r.phaseDone) this.time.delayedCall(1300, () => this.phaseBeat(true));
        break;
      case "not-caught":
        SFX.deny();
        this.setStatus("You haven't caught it shift yet. Press it first.", CSS.muted);
        break;
      case "strike":
        SFX.wrong();
        this.cameras.main.shake(150, 0.004);
        this.updateHud();
        if (r.failed) {
          this.setStatus("He's had enough — he won't talk this point again.", CSS.slate);
          this.time.delayedCall(1300, () => this.phaseBeat(false));
        } else this.setStatus("He bristles. That line was straight.", CSS.slate);
        break;
    }
  }

  private phaseBeat(cleared: boolean): void {
    this.busy = true;
    const last = this.inq.phaseIdx + 1 >= this.inq.case.phases.length;
    const o = this.add.container(0, 0).setDepth(110);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.9));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, cleared ? "— the point is yours —" : "— he closes that door —", { fontFamily: DISPLAY, fontSize: "20px", color: cleared ? CSS.amber : CSS.slate, fontStyle: "italic" }).setOrigin(0.5));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, last ? "Now he gives you the whole of it." : "On to the next.", { fontFamily: BODY, fontSize: "14px", color: CSS.muted }).setOrigin(0.5));
    this.time.delayedCall(1500, () => {
      o.destroy();
      this.busy = false;
      this.inq.advance();
      this.enterMode();
    });
  }

  // ---- confront: the web -----------------------------------------------------

  private renderWeb(): void {
    this.blocks.forEach((b) => b.destroy());
    this.blocks = [];
    const views = this.inq.segments();
    const broken = new Set(views.filter((v) => v.broken).map((v) => v.id));
    let y = 192;
    for (const s of views) {
      const label = this.add.text(LEFT, y, `「 ${s.name}${s.key ? " ✦" : ""} 」`, { fontFamily: MONO, fontSize: "11px", color: s.broken ? CSS.faint : CSS.muted }).setDepth(6);
      this.blocks.push(label);
      const body = this.add.text(LEFT, y + 18, s.text, { fontFamily: BODY, fontSize: "16px", color: s.broken ? CSS.faint : CSS.ink, wordWrap: { width: WRAP }, lineSpacing: 2 }).setDepth(6);
      this.blocks.push(body);
      let cy = y + 18 + body.height + 4;
      if (s.broken) {
        const g = this.add.graphics().setDepth(7);
        g.lineStyle(1.6, COLORS.crimson, 0.9);
        g.lineBetween(LEFT, y + 18 + body.height / 2, LEFT + body.width, y + 18 + body.height / 2);
        this.blocks.push(g);
      } else if (s.leansOn) {
        const gone = broken.has(s.leansOn);
        const txt = gone ? `↳ its cover (${this.inq.segmentName(s.leansOn)}) is gone — press it now` : `↳ leaning on ${this.inq.segmentName(s.leansOn)} — break that first`;
        const note = this.add.text(LEFT + 12, cy, txt, { fontFamily: MONO, fontSize: "11px", color: gone ? CSS.crimsonBright : CSS.amber }).setDepth(6);
        this.blocks.push(note);
        cy += note.height + 2;
      } else if (s.propsUp.length > 0) {
        const note = this.add.text(LEFT + 12, cy, `↑ this is holding up ${s.propsUp.map((p) => this.inq.segmentName(p)).join(", ")}`, { fontFamily: MONO, fontSize: "11px", color: CSS.amber }).setDepth(6);
        this.blocks.push(note);
        cy += note.height + 2;
      }
      y = cy + 22;
    }
  }

  private doPresent(): void {
    if (this.busy) return;
    if (this.inq.heldEvidence().length === 0) {
      this.setStatus("Your file is empty.", CSS.muted);
      return;
    }
    this.showPicker();
  }

  private resolve(evId: string): void {
    const r = this.inq.present(evId);
    switch (r.kind) {
      case "deflect": {
        SFX.flicker();
        this.renderWeb();
        const via = this.inq.segmentName(r.via);
        const tgt = this.inq.segmentName(r.target);
        this.setStatus(`He slips it. ${tgt} hides behind ${via} — so take ${via} apart first.`, CSS.amber);
        if (r.revealed) this.time.delayedCall(800, () => this.centerToast("That shakes loose:  " + r.revealed!.label));
        break;
      }
      case "break": {
        SFX.pin();
        this.renderWeb();
        this.updateHud();
        if (r.solved) {
          this.setStatus("It caves — and the whole story with it.", CSS.crimsonBright);
          this.time.delayedCall(900, () => this.solve());
        } else this.setStatus(`${this.inq.segmentName(r.target)} collapses. Whatever it covered is exposed now — press it.`, CSS.crimsonBright);
        break;
      }
      case "already":
        SFX.deny();
        this.setStatus("That's already in pieces.", CSS.muted);
        break;
      default:
        SFX.deny();
        this.setStatus("He shrugs it off — that doesn't bear on this.", CSS.slate);
    }
  }

  // ---- overlays --------------------------------------------------------------

  private centerToast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, 700, msg, { fontFamily: MONO, fontSize: "12px", color: CSS.amber, align: "center", wordWrap: { width: 440 } }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: 2200, duration: 700, onComplete: () => t.destroy() });
  }

  private showPicker(): void {
    this.busy = true;
    const leads = this.inq.heldEvidence();
    const o = this.add.container(0, 0).setDepth(120);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    o.add(this.add.text(GAME_WIDTH / 2, 100, "press him with what?", { fontFamily: DISPLAY, fontSize: "23px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    const rows: Button[] = [];
    let y = 160;
    leads.forEach((e) => {
      const b = new Button(this, GAME_WIDTH / 2, y, { w: 430, h: 52, label: e.label, fontSize: 12, accent: COLORS.slate, onClick: () => choose(e.id) });
      rows.push(b);
      o.add(b);
      y += 60;
    });
    const cancelBtn = new Button(this, GAME_WIDTH / 2, Math.min(y + 8, GAME_HEIGHT - 56), { w: 180, h: 46, label: "CANCEL  (B)", accent: COLORS.crimson, onClick: () => close() });
    o.add(cancelBtn);
    const items = [...rows, cancelBtn];
    let focus = 0;
    const paint = () => items.forEach((b, idx) => b.setActive2(idx === focus));
    paint();
    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
      this.pickHandler = null;
    };
    const choose = (id: string) => {
      close();
      this.resolve(id);
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
      } else if (i === PAD.A || i === PAD.X) {
        if (focus < rows.length) choose(leads[focus].id);
        else close();
      } else if (i === PAD.B) close();
    };
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
    const leads = this.inq.confronting ? this.inq.heldEvidence().map((e) => e.label) : [];
    const ev = this.inq.confronting && leads.length ? "leads in hand:\n" + leads.map((l) => "•  " + l).join("\n") : "";
    if (ev) o.add(this.add.text(GAME_WIDTH / 2, 430, ev, { fontFamily: MONO, fontSize: "12px", color: CSS.muted, align: "left", wordWrap: { width: 408 }, lineSpacing: 4 }).setOrigin(0.5, 0));
    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
    };
    this.overlayClose = close;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 72, { w: 220, h: 50, label: initial ? "BEGIN  (A)" : "CLOSE  (A/Y)", accent: COLORS.crimson, onClick: close }));
  }

  private solve(): void {
    this.busy = true;
    const o = this.add.container(0, 0).setDepth(140);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.97));
    if (this.textures.exists("grain")) o.add(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setAlpha(0.5));
    if (this.textures.exists("vignette")) o.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    o.add(this.add.text(GAME_WIDTH / 2, 110, "the story breaks", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    o.add(this.add.text(GAME_WIDTH / 2, 158, this.inq.case.resolution, { fontFamily: BODY, fontSize: "15px", color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));
    SFX.break();
    const back = () => this.scene.start("TitleScene");
    this.overlayClose = back;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 68, { w: 220, h: 50, label: "CLOSE THE FILE  (A)", accent: COLORS.crimson, onClick: back }));
  }
}
