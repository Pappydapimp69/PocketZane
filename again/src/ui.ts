import Phaser from "phaser";
import { COLORS, CSS, MONO } from "./theme";

export interface ButtonOpts {
  w: number;
  h: number;
  label: string;
  fontSize?: number;
  accent?: number;
  onClick: () => void;
}

/** A flat, tap-friendly button with enabled / active states. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  private opts: ButtonOpts;
  private selected = false;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.bg = scene.add.graphics();
    this.txt = scene.add
      .text(0, 0, opts.label, {
        fontFamily: MONO,
        fontSize: `${opts.fontSize ?? 15}px`,
        color: CSS.ink,
        fontStyle: "600",
      })
      .setOrigin(0.5);
    this.add([this.bg, this.txt]);

    this.setSize(opts.w, opts.h);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-opts.w / 2, -opts.h / 2, opts.w, opts.h),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on("pointerdown", () => this.enabled && this.setScale(0.96));
    this.on("pointerup", () => {
      if (!this.enabled) return;
      this.setScale(1);
      opts.onClick();
    });
    this.on("pointerout", () => this.setScale(1));

    scene.add.existing(this);
    this.render();
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.35);
    return this;
  }
  setActive2(on: boolean): this {
    this.selected = on;
    this.render();
    return this;
  }
  setLabel(s: string): this {
    this.txt.setText(s);
    return this;
  }

  private render(): void {
    const { w, h } = this.opts;
    const a = this.opts.accent ?? COLORS.slate;
    this.bg.clear();
    this.bg.fillStyle(this.selected ? a : COLORS.panel, this.selected ? 0.9 : 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    this.bg.lineStyle(1.5, this.selected ? a : COLORS.panelEdge, 1);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  }
}
