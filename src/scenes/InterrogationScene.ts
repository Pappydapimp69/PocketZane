import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { Inquiry, PHASE_STRIKES } from "../game/deduction";
import { WELLS_STREET } from "../game/cases2";
import { SFX, startAmbience, stopSpeech } from "../game/audio";
import { addAtmosphere } from "../game/textures";
import { PAD } from "../input";

const LEFT = 28;
const RIGHT = GAME_WIDTH - 28;
const TOP = 188;
const FONT = 16;
const LINE_H = 28;

interface ClauseLayout {
  id: string;
  struck: boolean;
  words: Phaser.GameObjects.Text[];
  runs: { x0: number; x1: number; top: number; bottom: number }[];
}

/** Phases (gather leads, three strikes) then a leveled confrontation. */
export class InterrogationScene extends Phaser.Scene {
  private inq!: Inquiry;
  private selected: string | null = null;
  private clauses: ClauseLayout[] = [];
  private marks!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private btnL!: Button;
  private btnR!: Button;
  private busy = false;
  private overlayClose: (() => void) | null = null;
  private pickHandler: ((i: number) => void) | null = null;
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
    this.setupInput();
    this.enterMode();
    this.showFile(true);
  }

  // ---- header / controls -----------------------------------------------------

  private buildHeader(): void {
    const c = this.inq.case;
    this.add.text(GAME_WIDTH / 2, 30, "AGAIN", { fontFamily: DISPLAY, fontSize: "22px", color: CSS.ink }).setOrigin(0.5).setLetterSpacing(6);
    const leave = this.add.text(14, 14, "← leave", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    leave.on("pointerup", () => this.scene.start("TitleScene"));
    this.add.text(GAME_WIDTH / 2, 58, c.title, { fontFamily: DISPLAY, fontSize: "14px", color: CSS.muted, fontStyle: "italic" }).setOrigin(0.5);
    this.title = this.add.text(GAME_WIDTH / 2, 86, "", { fontFamily: DISPLAY, fontSize: "18px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5);
    this.hud = this.add.text(GAME_WIDTH / 2, 112, "", { fontFamily: MONO, fontSize: "12px", color: CSS.faint }).setOrigin(0.5);
    this.prompt = this.add.text(GAME_WIDTH / 2, 142, "", { fontFamily: BODY, fontSize: "13px", color: CSS.muted, align: "center", wordWrap: { width: 430 } }).setOrigin(0.5);
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.panelEdge, 0.6);
    rule.fillRect(40, 168, GAME_WIDTH - 80, 1);
  }

  private buildControls(): void {
    this.status = this.add
      .text(GAME_WIDTH / 2, 748, "", { fontFamily: BODY, fontSize: "14px", color: CSS.muted, fontStyle: "italic", align: "center", wordWrap: { width: 444 } })
      .setOrigin(0.5);
    this.btnL = new Button(this, 116, 810, { w: 200, h: 50, label: "", fontSize: 13, accent: COLORS.slate, onClick: () => this.actL() });
    this.btnR = new Button(this, 332, 810, { w: 200, h: 50, label: "", fontSize: 13, accent: COLORS.crimson, onClick: () => this.actR() });
    this.add.text(GAME_WIDTH - 14, 14, "the file  (Y)", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showFile(false));
  }

  /** Reconfigure header + buttons for the current mode. */
  private enterMode(): void {
    this.selected = null;
    if (this.inq.confronting) {
      this.title.setText("The Confrontation");
      this.prompt.setText(this.inq.case.confront.intro);
      this.btnL.setLabel("PRESENT  A");
      this.btnR.setLabel("THE FILE  X");
    } else {
      const p = this.inq.phase;
      this.title.setText(p.title);
      this.prompt.setText(p.prompt);
      this.btnL.setLabel("QUESTION  A");
      this.btnR.setLabel("PIN  X");
    }
    this.render();
    this.updateHud();
    this.setStatus("");
  }

  private updateHud(): void {
    if (this.inq.confronting) {
      this.hud.setText(`cornered ${this.inq.brokenCount}/${this.inq.total}    ·    leads ${this.inq.heldLeads().length}`);
    } else {
      const s = this.inq.phaseStrikes;
      const dots = "●".repeat(s) + "○".repeat(Math.max(0, PHASE_STRIKES - s));
      this.hud.setText(`patience ${dots}    ·    leads ${this.inq.heldLeads().length}`);
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
    if (i === PAD.UP) this.moveSelection(-1);
    else if (i === PAD.DOWN) this.moveSelection(1);
    else if (i === PAD.A) this.actL();
    else if (i === PAD.X || i === PAD.LT) this.actR();
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

  // ---- shared clause rendering ----------------------------------------------

  private items(): { id: string; text: string; struck: boolean; selectable: boolean }[] {
    if (this.inq.confronting) return this.inq.claims().map((c) => ({ id: c.id, text: c.text, struck: c.broken, selectable: !c.broken }));
    return this.inq.phaseLines().map((l) => ({ id: l.id, text: l.text, struck: l.pinned, selectable: !l.pinned }));
  }

  private selectableIds(): string[] {
    return this.items().filter((i) => i.selectable).map((i) => i.id);
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
    if (this.busy) return;
    const it = this.items().find((x) => x.id === id);
    if (!it || !it.selectable) return;
    this.selected = this.selected === id ? null : id;
    this.drawMarks();
    SFX.select();
  }

  private measureSpace(): void {
    if (this.spaceMeasured) return;
    const a = this.add.text(0, 0, "n n", { fontFamily: BODY, fontSize: `${FONT}px` });
    const b = this.add.text(0, 0, "nn", { fontFamily: BODY, fontSize: `${FONT}px` });
    this.spaceW = Math.max(3, a.width - b.width);
    a.destroy();
    b.destroy();
    this.spaceMeasured = true;
  }

  private render(): void {
    this.measureSpace();
    this.clauses.forEach((c) => c.words.forEach((w) => w.destroy()));
    this.clauses = [];
    let x = LEFT;
    let y = TOP;
    for (const it of this.items()) {
      const words = it.text.split(/\s+/).filter(Boolean);
      const objs: Phaser.GameObjects.Text[] = [];
      const runs: ClauseLayout["runs"] = [];
      let run: ClauseLayout["runs"][number] | null = null;
      for (const w of words) {
        const t = this.add.text(0, 0, w, { fontFamily: BODY, fontSize: `${FONT}px`, color: it.struck ? CSS.faint : CSS.ink }).setDepth(6);
        if (x + t.width > RIGHT && x > LEFT) {
          x = LEFT;
          y += LINE_H;
          run = null;
        }
        t.setPosition(x, y);
        t.setInteractive({ useHandCursor: true });
        t.on("pointerup", () => this.onClauseTap(it.id));
        objs.push(t);
        if (!run || run.top !== y) {
          run = { x0: x, x1: x + t.width, top: y, bottom: y + t.height };
          runs.push(run);
        } else run.x1 = x + t.width;
        x += t.width + this.spaceW;
      }
      x += this.spaceW;
      this.clauses.push({ id: it.id, struck: it.struck, words: objs, runs });
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

  // ---- phase verbs -----------------------------------------------------------

  private doQuestion(): void {
    if (this.busy) return;
    if (!this.selected) {
      this.setStatus("Pick a line of his account, then question it.", CSS.muted);
      return;
    }
    const r = this.inq.question(this.selected);
    if (r.shifted) {
      SFX.flicker();
      this.render();
      this.setStatus("Something in it moves.", CSS.amber);
    } else {
      SFX.again();
      this.setStatus("He says it the same way. Unmoved.", CSS.muted);
    }
  }

  private doPin(): void {
    if (this.busy || !this.selected) {
      if (!this.selected) this.setStatus("Select the line you mean to call a lie.", CSS.muted);
      return;
    }
    const r = this.inq.pin(this.selected);
    switch (r.kind) {
      case "lead":
        SFX.pin();
        this.render();
        this.updateHud();
        this.setStatus("Caught. That's a lead.", CSS.crimsonBright);
        this.centerToast("New lead:  " + r.lead.label);
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
          this.setStatus("He's had enough. He won't talk about this again.", CSS.slate);
          this.time.delayedCall(1300, () => this.phaseBeat(false));
        } else {
          this.setStatus("He bristles. That line was straight.", CSS.slate);
        }
        break;
    }
  }

  private phaseBeat(cleared: boolean): void {
    this.busy = true;
    const last = this.inq.phaseIdx + 1 >= this.inq.case.phases.length;
    const head = cleared ? "— the point is yours —" : "— he closes that door —";
    const o = this.add.container(0, 0).setDepth(110);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.9));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, head, { fontFamily: DISPLAY, fontSize: "20px", color: cleared ? CSS.amber : CSS.slate, fontStyle: "italic" }).setOrigin(0.5));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, last ? "He gathers himself for the whole of it." : "On to the next.", { fontFamily: BODY, fontSize: "14px", color: CSS.muted }).setOrigin(0.5));
    this.time.delayedCall(1500, () => {
      o.destroy();
      this.busy = false;
      this.inq.advance();
      this.enterMode();
    });
  }

  // ---- confrontation verbs ---------------------------------------------------

  private doPresent(): void {
    if (this.busy) return;
    if (!this.selected) {
      this.setStatus("Select the claim you mean to break, then present.", CSS.muted);
      return;
    }
    if (this.inq.heldLeads().length === 0) {
      this.setStatus("Your file is empty.", CSS.muted);
      return;
    }
    this.showPicker();
  }

  private presentLead(leadId: string): void {
    const r = this.inq.present(this.selected!, leadId);
    switch (r.kind) {
      case "break":
        SFX.pin();
        this.render();
        this.selected = null;
        this.updateHud();
        if (r.solved) {
          this.setStatus("It caves. The whole thing comes down with it.", CSS.crimsonBright);
          this.time.delayedCall(900, () => this.solve());
        } else {
          this.setStatus("That claim caves. Keep stacking.", CSS.crimsonBright);
        }
        break;
      case "partial":
        SFX.flicker();
        this.render();
        this.setStatus("It holds — but the story bends to take the weight.", CSS.amber);
        if (r.revealed) this.time.delayedCall(800, () => this.centerToast("That shakes loose:  " + r.revealed!.label));
        break;
      case "nomatch":
        SFX.deny();
        this.setStatus("He shrugs it off. That doesn't bear on this claim.", CSS.slate);
        break;
      case "spent":
        SFX.deny();
        this.setStatus("You've already leaned on this here.", CSS.muted);
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
    o.add(this.add.text(GAME_WIDTH / 2, 64, "the file", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    const body = `${c.brief.what}\n\n${c.brief.where}  ${c.brief.when}\n\n${c.brief.why}\n\n— ${c.brief.goal}`;
    o.add(this.add.text(GAME_WIDTH / 2, 104, body, { fontFamily: BODY, fontSize: "15px", color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));
    const leads = this.inq.heldLeads();
    const evText = leads.length ? "leads in hand:\n" + leads.map((e) => "•  " + e.label).join("\n") : "leads in hand: none yet — work the phases.";
    o.add(this.add.text(GAME_WIDTH / 2, 430, evText, { fontFamily: MONO, fontSize: "12px", color: CSS.muted, align: "left", wordWrap: { width: 408 }, lineSpacing: 4 }).setOrigin(0.5, 0));
    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
    };
    this.overlayClose = close;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, { w: 220, h: 50, label: initial ? "BEGIN  (A)" : "CLOSE  (A/Y)", accent: COLORS.crimson, onClick: close }));
  }

  private showPicker(): void {
    this.busy = true;
    const leads = this.inq.heldLeads();
    const fact = this.inq.case.confront.claims.find((c) => c.id === this.selected)?.fact ?? "";
    const o = this.add.container(0, 0).setDepth(120);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    o.add(this.add.text(GAME_WIDTH / 2, 96, "present what?", { fontFamily: DISPLAY, fontSize: "24px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    const rows: Button[] = [];
    let y = 150;
    leads.forEach((e) => {
      const spent = this.inq.leadUsedOn(e.id, fact);
      const b = new Button(this, GAME_WIDTH / 2, y, { w: 430, h: 50, label: spent ? `${e.label}   ✓ used` : e.label, fontSize: 12, accent: spent ? COLORS.faint : COLORS.slate, onClick: () => choose(e.id) });
      rows.push(b);
      o.add(b);
      y += 58;
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
      this.presentLead(id);
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
        if (focus < rows.length) choose(leads[focus].id);
        else close();
      } else if (i === PAD.B) close();
    };
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
