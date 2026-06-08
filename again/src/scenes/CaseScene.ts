import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { COLORS, CSS, DISPLAY, BODY, MONO } from "../theme";
import { Button } from "../ui";
import { Interrogation, LineView } from "../game/engine";
import { CASES } from "../game/cases";
import { SFX } from "../game/audio";

const CARD_X = GAME_WIDTH / 2;
const CARD_W = 432;
const WRAP = 392;
const LIST_TOP = 150;

export class CaseScene extends Phaser.Scene {
  private game_!: Interrogation;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private cards: Phaser.GameObjects.Container[] = [];
  private selected: string | null = null;
  private pinBtn!: Button;
  private busy = false;

  constructor() {
    super("CaseScene");
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    this.game_ = new Interrogation(CASES[0]);

    this.buildHeader();
    this.buildControls();
    this.renderCards();
    this.updateHud();
  }

  private buildHeader(): void {
    const c = this.game_.case;
    this.add
      .text(GAME_WIDTH / 2, 34, "AGAIN", { fontFamily: DISPLAY, fontSize: "26px", color: CSS.ink })
      .setOrigin(0.5)
      .setLetterSpacing(6);
    this.add
      .text(GAME_WIDTH / 2, 66, c.title, { fontFamily: DISPLAY, fontSize: "15px", color: CSS.amber, fontStyle: "italic" })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 92, c.intro, {
        fontFamily: BODY,
        fontSize: "13px",
        color: CSS.muted,
        align: "center",
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5);
    this.hud = this.add
      .text(GAME_WIDTH / 2, 122, "", { fontFamily: MONO, fontSize: "12px", color: CSS.faint })
      .setOrigin(0.5);
  }

  private buildControls(): void {
    this.status = this.add
      .text(GAME_WIDTH / 2, 762, "", { fontFamily: BODY, fontSize: "14px", color: CSS.muted, fontStyle: "italic" })
      .setOrigin(0.5);

    this.pinBtn = new Button(this, 124, 808, {
      w: 208,
      h: 50,
      label: "PIN THE LIE",
      accent: COLORS.crimson,
      onClick: () => this.doPin(),
    }).setEnabled(false);

    new Button(this, 356, 808, {
      w: 208,
      h: 50,
      label: "TELL ME AGAIN",
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
      fontSize: "15px",
      color: v.pinned ? CSS.faint : CSS.ink,
      wordWrap: { width: WRAP },
      lineSpacing: 3,
    });
    const h = Math.max(46, txt.height + 22);
    txt.setPosition(-WRAP / 2, -h / 2 + 11);

    const bg = this.add.graphics();
    const marker = this.add.graphics();

    const container = this.add.container(CARD_X, top + h / 2, [bg, marker, txt]);
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
    bg.fillStyle(COLORS.panel, v.pinned ? 0.5 : 1);
    bg.fillRoundedRect(-CARD_W / 2, -h / 2, CARD_W, h, 8);
    const edge = sel ? COLORS.amber : v.pinned ? COLORS.crimson : COLORS.panelEdge;
    bg.lineStyle(sel ? 2 : 1.5, edge, 1);
    bg.strokeRoundedRect(-CARD_W / 2, -h / 2, CARD_W, h, 8);

    // Left marker: caught (amber) or pinned (crimson) — your ledger remembers.
    marker.clear();
    if (v.pinned) {
      marker.fillStyle(COLORS.crimson, 1);
      marker.fillRoundedRect(-CARD_W / 2, -h / 2, 4, h, 2);
    } else if (v.caught) {
      marker.fillStyle(COLORS.amber, 0.9);
      marker.fillRoundedRect(-CARD_W / 2, -h / 2, 4, h, 2);
    }
  }

  // ---- interaction -----------------------------------------------------------

  private onCardTap(id: string): void {
    if (this.busy) return;
    const v = this.game_.view().find((x) => x.id === id)!;
    if (v.pinned) return;
    this.selected = this.selected === id ? null : id;
    this.cards.forEach((card) => {
      const cv = this.game_.view().find((x) => x.id === (card.getData("id") as string))!;
      this.paintCard(card, cv);
    });
    this.pinBtn.setEnabled(this.selected !== null);
    SFX.select();
  }

  private doAgain(): void {
    if (this.busy || this.game_.broken || this.game_.lost) return;
    SFX.again();
    const moved = this.game_.again();
    this.selected = null;
    this.pinBtn.setEnabled(false);
    this.renderCards();
    this.updateHud();
    if (moved.length > 0) {
      SFX.flicker();
      this.setStatus("Something moved.", CSS.amber);
    } else {
      this.setStatus("It held, that time.", CSS.muted);
    }
  }

  private doPin(): void {
    if (this.busy || !this.selected) return;
    const id = this.selected;
    const res = this.game_.pin(id);
    switch (res.kind) {
      case "pinned":
        SFX.pin();
        this.setStatus("Pinned. It can't take that back.", CSS.crimsonBright);
        this.selected = null;
        this.pinBtn.setEnabled(false);
        this.renderCards();
        this.updateHud();
        if (res.broke) this.time.delayedCall(600, () => this.breakStory());
        break;
      case "not-yet":
        SFX.deny();
        this.setStatus("You haven't caught it move. Make it tell again.", CSS.muted);
        break;
      case "false":
        SFX.wrong();
        this.cameras.main.shake(160, 0.004);
        this.setStatus(
          res.out ? "That was the truth. He's done talking." : "That one was true. He steadies.",
          CSS.slate,
        );
        this.updateHud();
        if (res.out) this.time.delayedCall(700, () => this.endLost());
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
    this.hud.setText(`telling ${g.telling}    ·    pinned ${g.case.pinsToBreak - g.pinsLeft}/${g.case.pinsToBreak}    ·    ${strikes}`);
  }

  private setStatus(msg: string, color: string): void {
    this.status.setText(msg).setColor(color);
  }

  private breakStory(): void {
    this.busy = true;
    SFX.break();
    this.showOverlay(this.game_.case.resolution, "the story breaks", CSS.amber);
  }

  private endLost(): void {
    this.busy = true;
    this.showOverlay(
      "He stands, buttons his coat, and leaves.\n\nYou pressed where there was nothing to give, and the one thread that would have held went slack. Some nights keep their shape no matter how often you ask.",
      "he walks",
      CSS.slate,
    );
  }

  private showOverlay(body: string, heading: string, headColor: string): void {
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.93);
    const head = this.add
      .text(GAME_WIDTH / 2, 220, heading, { fontFamily: DISPLAY, fontSize: "24px", color: headColor, fontStyle: "italic" })
      .setOrigin(0.5);
    const text = this.add
      .text(GAME_WIDTH / 2, 270, body, {
        fontFamily: BODY,
        fontSize: "16px",
        color: CSS.ink,
        align: "left",
        wordWrap: { width: 400 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    c.add([dim, head, text]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 600 });

    const again = new Button(this, GAME_WIDTH / 2, 800, {
      w: 260,
      h: 50,
      label: "AGAIN, FROM THE TOP",
      accent: COLORS.slate,
      onClick: () => this.scene.restart(),
    });
    c.add(again);
  }
}
