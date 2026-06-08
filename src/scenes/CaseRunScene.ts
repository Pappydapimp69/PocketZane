import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { MergedInquiry, PHASE_STRIKES, MergedCase } from "../game/merged";
import { WELLS } from "../game/mergedcase";
import { generateMergedCase } from "../game/generateweb";
import { dailySeed, DAILY_OPTS, optsForNight, nightSeed, randomSeed, freeOpts } from "../game/ladder";
import { incBreaks, markDeepest, rankFor, getTotalBreaks } from "../game/save";
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

  private theCase: MergedCase = WELLS;
  private seedVal = 1;
  private mode: "free" | "daily" | "endless" = "free";
  private night = 1;
  private runBase = 1;
  private recorded = false;

  constructor() {
    super("CaseRun");
  }

  init(data: { generate?: boolean; seed?: number; mode?: "free" | "daily" | "endless"; night?: number; runBase?: number }): void {
    this.mode = data?.mode ?? "free";
    this.recorded = false;
    if (this.mode === "daily") {
      this.seedVal = dailySeed();
      this.theCase = generateMergedCase(this.seedVal, DAILY_OPTS);
    } else if (this.mode === "endless") {
      this.night = Math.max(1, data?.night ?? 1);
      this.runBase = data?.runBase ?? ((Date.now() & 0x7fffffff) >>> 0);
      this.seedVal = nightSeed(this.runBase, this.night);
      this.theCase = generateMergedCase(this.seedVal, optsForNight(this.night));
    } else if (data?.generate) {
      this.seedVal = data?.seed ?? randomSeed();
      this.theCase = generateMergedCase(this.seedVal, freeOpts(this.seedVal));
    } else {
      // The crafted reference case (reachable via the N shortcut).
      this.seedVal = data?.seed ?? 1;
      this.theCase = WELLS;
    }
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(360);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });
    startAmbience();
    this.inq = new MergedInquiry(this.theCase, this.seedVal);
    this.marks = this.add.graphics().setDepth(5);
    this.busy = false;

    const c = this.inq.case;
    this.add.text(GAME_WIDTH / 2, 30, "AGAIN", { fontFamily: DISPLAY, fontSize: "22px", color: CSS.ink }).setOrigin(0.5).setLetterSpacing(6);
    this.add.text(14, 14, "← leave", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.scene.start("TitleScene"));
    this.add.text(GAME_WIDTH - 14, 14, "the file  (Y)", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showFile(false));
    const tag = this.mode === "daily" ? "today's subject" : this.mode === "endless" ? `night ${this.night}` : "";
    if (tag) this.add.text(GAME_WIDTH / 2, 44, tag, { fontFamily: MONO, fontSize: "10px", color: CSS.faint }).setOrigin(0.5);
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
        this.updateHud();
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
        if (r.keystone && r.cascaded && r.cascaded.length) {
          SFX.break();
          this.cameras.main.shake(220, 0.005);
          this.setStatus("It evaporates — there was never a floor under it. Everything leaning on it comes down at once.", CSS.crimsonBright);
        } else {
          this.setStatus(r.solved ? "It caves — and the whole story with it." : `${this.inq.segmentName(r.target)} collapses. Whatever it covered is exposed now — press it.`, CSS.crimsonBright);
        }
        if (r.solved) this.time.delayedCall(1100, () => this.solve());
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

  /** Solving a case feeds the record: a break toward rank, plus depth in endless. */
  private recordWin(): void {
    if (this.recorded) return;
    this.recorded = true;
    incBreaks();
    if (this.mode === "endless") markDeepest(this.night);
  }

  private solve(): void {
    this.busy = true;
    this.recordWin();
    const o = this.add.container(0, 0).setDepth(140);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.97));
    if (this.textures.exists("grain")) o.add(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setAlpha(0.5));
    if (this.textures.exists("vignette")) o.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    SFX.break();

    const reso = this.add.container(0, 0);
    reso.add(this.add.text(GAME_WIDTH / 2, 110, "the story breaks", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    reso.add(this.add.text(GAME_WIDTH / 2, 158, this.inq.case.resolution, { fontFamily: BODY, fontSize: "15px", color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));
    if (this.mode === "endless") {
      reso.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 150, `night ${this.night} closed  ·  rank ${rankFor(getTotalBreaks())}`, { fontFamily: MONO, fontSize: "11px", color: CSS.amber }).setOrigin(0.5));
    }
    const diagram = this.buildDiagram().setVisible(false);
    o.add([reso, diagram]);

    const toTitle = () => this.scene.start("TitleScene");
    const nextNight = () => this.scene.start("CaseRun", { mode: "endless", night: this.night + 1, runBase: this.runBase });
    const onward = this.mode === "endless" ? nextNight : toTitle;
    const showBoard = () => {
      reso.setVisible(false);
      diagram.setVisible(true);
      this.overlayClose = backToReso;
    };
    const backToReso = () => {
      diagram.setVisible(false);
      reso.setVisible(true);
      this.overlayClose = onward;
    };
    this.overlayClose = onward;

    reso.add(new Button(this, 132, GAME_HEIGHT - 68, { w: 220, h: 50, label: "▦  THE WEB", fontSize: 14, accent: COLORS.slate, onClick: showBoard }));
    reso.add(
      this.mode === "endless"
        ? new Button(this, 350, GAME_HEIGHT - 68, { w: 200, h: 50, label: "NEXT NIGHT  (A)", fontSize: 13, accent: COLORS.crimson, onClick: nextNight })
        : new Button(this, 350, GAME_HEIGHT - 68, { w: 200, h: 50, label: "CLOSE  (A)", fontSize: 13, accent: COLORS.crimson, onClick: toTitle }),
    );
    diagram.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 56, { w: 200, h: 46, label: "BACK  (B)", accent: COLORS.slate, onClick: backToReso }));
  }

  /** A win-screen "case board" laid out from the actual web graph. */
  private buildDiagram(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    c.add(this.add.text(GAME_WIDTH / 2, 64, "the web", { fontFamily: DISPLAY, fontSize: "24px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    c.add(this.add.text(GAME_WIDTH / 2, 90, "one lie holding up another", { fontFamily: MONO, fontSize: "11px", color: CSS.muted }).setOrigin(0.5));

    const segs = this.inq.case.web.segments;
    const evs = this.inq.case.web.evidence;
    const brokenSet = new Set(this.inq.segments().filter((s) => s.broken).map((s) => s.id));

    // support edges (d props target) and per-segment "support depth"
    const supportsOf = (id: string) => evs.filter((e) => e.targets === id).flatMap((e) => e.deflectableBy);
    const memo = new Map<string, number>();
    const level = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      const sup = supportsOf(id);
      const v = sup.length ? 1 + Math.max(...sup.map(level)) : 0;
      memo.set(id, v);
      return v;
    };
    const maxL = Math.max(0, ...segs.map((s) => level(s.id)));

    const distribute = (n: number, w: number): number[] => {
      const gap = 16;
      const total = n * w + (n - 1) * gap;
      const x0 = (GAME_WIDTH - total) / 2 + w / 2;
      return Array.from({ length: n }, (_, i) => x0 + i * (w + gap));
    };

    // lie node positions, by level row
    const lieW = maxL > 0 ? 178 : 220;
    const topY = 300;
    const rowGap = 130;
    const pos = new Map<string, { x: number; y: number }>();
    for (let L = 0; L <= maxL; L++) {
      const row = segs.filter((s) => level(s.id) === L);
      const xs = distribute(row.length, lieW);
      row.forEach((s, i) => pos.set(s.id, { x: xs[i], y: topY + (maxL - L) * rowGap }));
    }
    // evidence row above the top lies
    const evXs = distribute(evs.length, 104);
    const evY = 168;
    const evPos = new Map<string, { x: number; y: number }>();
    evs.forEach((e, i) => evPos.set(e.id, { x: evXs[i], y: evY }));

    const g = this.add.graphics();
    c.add(g);
    const lieH = 52;
    // support edges (amber)
    const seen = new Set<string>();
    for (const e of evs) {
      for (const d of e.deflectableBy) {
        const key = `${d}->${e.targets}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pos.get(d)!;
        const b = pos.get(e.targets)!;
        this.arrow(g, a.x, a.y - lieH / 2, b.x, b.y + lieH / 2, COLORS.amber, 0.9);
      }
    }
    // attack edges (crimson)
    for (const e of evs) {
      const a = evPos.get(e.id)!;
      const b = pos.get(e.targets)!;
      this.arrow(g, a.x, a.y + 18, b.x, b.y - lieH / 2, COLORS.crimson, 0.8);
    }

    // evidence nodes
    for (const e of evs) {
      const p = evPos.get(e.id)!;
      this.node(c, p.x, p.y, 104, 36, e.short ?? e.label, { evidence: true });
    }
    // lie nodes
    for (const s of segs) {
      const p = pos.get(s.id)!;
      this.node(c, p.x, p.y, lieW, lieH, s.name, { key: s.key, broken: brokenSet.has(s.id) });
    }

    c.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 130, "amber holds it up · crimson takes it down", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(0.5));
    return c;
  }

  private node(c: Phaser.GameObjects.Container, cx: number, cy: number, w: number, h: number, name: string, opts: { evidence?: boolean; key?: boolean; broken?: boolean }): void {
    const g = this.add.graphics();
    const edge = opts.broken ? COLORS.crimson : opts.evidence ? COLORS.panelEdge : COLORS.slate;
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);
    g.lineStyle(opts.broken ? 2 : 1.4, edge, opts.broken ? 0.85 : 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);
    c.add(g);
    const label = `${opts.key ? "✦ " : ""}${name}`;
    const t = this.add.text(cx, cy, label, { fontFamily: opts.evidence ? MONO : BODY, fontSize: opts.evidence ? "11px" : "14px", color: opts.broken ? CSS.faint : CSS.ink, align: "center", wordWrap: { width: w - 14 } }).setOrigin(0.5);
    c.add(t);
    if (opts.broken) {
      const s = this.add.graphics();
      s.lineStyle(1.5, COLORS.crimson, 0.9);
      s.lineBetween(cx - w / 2 + 10, cy, cx + w / 2 - 10, cy);
      c.add(s);
    }
  }

  private arrow(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.lineBetween(x1, y1, x2, y2);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const s = 7;
    g.fillStyle(color, alpha);
    g.fillTriangle(
      x2,
      y2,
      x2 - s * Math.cos(ang - 0.4),
      y2 - s * Math.sin(ang - 0.4),
      x2 - s * Math.cos(ang + 0.4),
      y2 - s * Math.sin(ang + 0.4),
    );
  }
}
