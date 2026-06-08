import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { WebInquiry } from "../game/web";
import { WELLS_WEB } from "../game/webcase";
import { SFX, startAmbience, stopSpeech } from "../game/audio";
import { addAtmosphere } from "../game/textures";
import { PAD } from "../input";

const LEFT = 30;
const WRAP = GAME_WIDTH - 60;

/** Constraint-web prototype: the suspect deflects through his own claims. */
export class WebScene extends Phaser.Scene {
  private inq!: WebInquiry;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private blocks: Phaser.GameObjects.GameObject[] = [];
  private busy = false;
  private overlayClose: (() => void) | null = null;
  private pickHandler: ((i: number) => void) | null = null;

  constructor() {
    super("Web");
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(360);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });
    startAmbience();
    this.inq = new WebInquiry(WELLS_WEB, (Date.now() & 0xffff) + 1);
    this.busy = false;

    const c = this.inq.case;
    this.add.text(GAME_WIDTH / 2, 30, "AGAIN", { fontFamily: DISPLAY, fontSize: "22px", color: CSS.ink }).setOrigin(0.5).setLetterSpacing(6);
    this.add.text(14, 14, "← leave", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.scene.start("TitleScene"));
    this.add.text(GAME_WIDTH - 14, 14, "the file  (Y)", { fontFamily: MONO, fontSize: "11px", color: CSS.faint }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showFile(false));
    this.add.text(GAME_WIDTH / 2, 58, c.title, { fontFamily: DISPLAY, fontSize: "15px", color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 80, c.subject, { fontFamily: BODY, fontSize: "13px", color: CSS.muted }).setOrigin(0.5);
    this.hud = this.add.text(GAME_WIDTH / 2, 104, "", { fontFamily: MONO, fontSize: "12px", color: CSS.faint }).setOrigin(0.5);
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.panelEdge, 0.6);
    rule.fillRect(40, 124, GAME_WIDTH - 80, 1);

    this.status = this.add.text(GAME_WIDTH / 2, 742, "", { fontFamily: BODY, fontSize: "14px", color: CSS.muted, fontStyle: "italic", align: "center", wordWrap: { width: 444 } }).setOrigin(0.5);
    new Button(this, 130, 810, { w: 220, h: 52, label: "PRESS HIM  (A)", fontSize: 14, accent: COLORS.crimson, onClick: () => this.doPresent() });
    new Button(this, 350, 810, { w: 200, h: 52, label: "THE FILE  (Y)", fontSize: 13, accent: COLORS.amber, onClick: () => this.showFile(false) });

    this.setupInput();
    this.renderWeb();
    this.updateHud();
    this.showFile(true);
  }

  private updateHud(): void {
    this.hud.setText(`alibi  ${this.inq.brokenCount}/${this.inq.total} broken    ·    leads ${this.inq.heldEvidence().length}`);
  }

  private setStatus(msg: string, color: string = CSS.muted): void {
    this.status.setText(msg).setColor(color);
  }

  // ---- render the cover story as labelled, dependency-annotated blocks --------

  private renderWeb(): void {
    this.blocks.forEach((b) => b.destroy());
    this.blocks = [];
    const views = this.inq.segments();
    const brokenIds = new Set(views.filter((v) => v.broken).map((v) => v.id));
    let y = 150;
    for (const s of views) {
      const label = this.add.text(LEFT, y, `「 ${s.name}${s.key ? " ✦" : ""} 」`, { fontFamily: MONO, fontSize: "11px", color: s.broken ? CSS.faint : CSS.muted }).setDepth(6);
      this.blocks.push(label);
      const body = this.add
        .text(LEFT, y + 18, s.text, { fontFamily: BODY, fontSize: "16px", color: s.broken ? CSS.faint : CSS.ink, wordWrap: { width: WRAP }, lineSpacing: 2 })
        .setDepth(6);
      this.blocks.push(body);
      let cy = y + 18 + body.height + 4;

      if (s.broken) {
        const g = this.add.graphics().setDepth(7);
        g.lineStyle(1.6, COLORS.crimson, 0.9);
        g.lineBetween(LEFT, y + 18 + body.height / 2, LEFT + body.width, y + 18 + body.height / 2);
        this.blocks.push(g);
      } else if (s.leansOn) {
        const coverGone = brokenIds.has(s.leansOn);
        const txt = coverGone ? `↳ its cover (${this.inq.segmentName(s.leansOn)}) is gone — press it now` : `↳ leaning on ${this.inq.segmentName(s.leansOn)} — break that`;
        const note = this.add.text(LEFT + 12, cy, txt, { fontFamily: MONO, fontSize: "11px", color: coverGone ? CSS.crimsonBright : CSS.amber }).setDepth(6);
        this.blocks.push(note);
        cy += note.height + 2;
      } else if (s.propsUp.length > 0 && !s.broken) {
        const who = s.propsUp.map((p) => this.inq.segmentName(p)).join(", ");
        const note = this.add.text(LEFT + 12, cy, `↑ this is holding up ${who}`, { fontFamily: MONO, fontSize: "11px", color: CSS.amber }).setDepth(6);
        this.blocks.push(note);
        cy += note.height + 2;
      }
      y = cy + 22;
    }
  }

  // ---- input -----------------------------------------------------------------

  private setupInput(): void {
    const kb = this.input.keyboard;
    kb?.on("keydown-ENTER", () => this.onPad(PAD.A));
    kb?.on("keydown-SPACE", () => this.onPad(PAD.A));
    kb?.on("keydown-Y", () => this.onPad(PAD.Y));
    kb?.on("keydown-UP", () => this.onPad(PAD.UP));
    kb?.on("keydown-DOWN", () => this.onPad(PAD.DOWN));
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
    if (i === PAD.A || i === PAD.X) this.doPresent();
    else if (i === PAD.Y) this.showFile(false);
  }

  // ---- present ---------------------------------------------------------------

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
        break;
      }
      case "break": {
        SFX.pin();
        this.renderWeb();
        this.updateHud();
        if (r.solved) {
          this.setStatus("It caves — and the whole story with it.", CSS.crimsonBright);
          this.time.delayedCall(900, () => this.solve());
        } else {
          this.setStatus(`${this.inq.segmentName(r.target)} collapses. Whatever it was covering is exposed now — press it.`, CSS.crimsonBright);
        }
        break;
      }
      case "already":
        SFX.deny();
        this.setStatus("That's already in pieces.", CSS.muted);
        break;
      default:
        SFX.deny();
        this.setStatus("He shrugs it off.", CSS.slate);
    }
  }

  // ---- overlays --------------------------------------------------------------

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
