import Phaser from "phaser";
import { mulberry32 } from "./rng";

/**
 * The crime scene, drawn from the seed — no image files. Every case is the same
 * premise (a man at the foot of his stairs, the rain running all night), so the
 * scene renders that: a night facade with a lit doorway at the head of the
 * stairs, rain, and a chalk outline at the bottom. The seed scatters the
 * building, the lit windows, the rain, and which side the stairs fall.
 */

const SW = 440;
const SH = 210;

export function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
  const rng = mulberry32((seed ^ 0x1f123bb5) >>> 0);
  const side = rng() < 0.5 ? -1 : 1; // stairs descend toward this side
  const wallTone = 14 + Math.floor(rng() * 10);

  // ---- night sky / wet wall ----
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${wallTone + 8},${wallTone + 12},${wallTone + 20})`);
  sky.addColorStop(1, `rgb(${wallTone - 4},${wallTone - 2},${wallTone + 2})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // ---- building facade ----
  ctx.fillStyle = `rgb(${wallTone},${wallTone + 2},${wallTone + 6})`;
  ctx.fillRect(0, 0, W, H * 0.62);
  // brick courses
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  for (let y = 12; y < H * 0.6; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // ---- windows, a few lit warm ----
  const cols = 4 + Math.floor(rng() * 2);
  const wgap = W / (cols + 1);
  for (let c = 1; c <= cols; c++) {
    for (let r = 0; r < 2; r++) {
      const wx = c * wgap - 16;
      const wy = 18 + r * 46;
      const lit = rng() < 0.34;
      ctx.fillStyle = lit ? "rgba(224,176,86,0.92)" : "rgba(10,12,16,0.9)";
      ctx.fillRect(wx, wy, 26, 32);
      if (lit) {
        const g = ctx.createRadialGradient(wx + 13, wy + 16, 2, wx + 13, wy + 16, 36);
        g.addColorStop(0, "rgba(224,176,86,0.35)");
        g.addColorStop(1, "rgba(224,176,86,0)");
        ctx.fillStyle = g;
        ctx.fillRect(wx - 24, wy - 24, 74, 80);
      }
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, 26, 32);
      ctx.beginPath();
      ctx.moveTo(wx + 13, wy);
      ctx.lineTo(wx + 13, wy + 32);
      ctx.moveTo(wx, wy + 16);
      ctx.lineTo(wx + 26, wy + 16);
      ctx.stroke();
    }
  }

  // ---- the doorway at the head of the stairs (light spills out) ----
  const doorX = W / 2 + side * W * 0.28;
  const doorY = H * 0.30;
  const doorW = 46;
  const doorH = 74;
  const spill = ctx.createRadialGradient(doorX + doorW / 2, doorY + doorH, 6, doorX + doorW / 2, doorY + doorH, 150);
  spill.addColorStop(0, "rgba(232,190,110,0.5)");
  spill.addColorStop(1, "rgba(232,190,110,0)");
  ctx.fillStyle = spill;
  ctx.fillRect(doorX - 110, doorY, 260, H - doorY);
  ctx.fillStyle = "rgba(245,205,130,0.95)";
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.fillStyle = "rgba(20,16,12,0.9)"; // a figure-less open frame edge
  ctx.fillRect(doorX, doorY, 6, doorH);
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 3;
  ctx.strokeRect(doorX, doorY, doorW, doorH);

  // ---- the stairs, descending from the door toward the foreground ----
  const steps = 7;
  const topX = doorX + doorW / 2;
  const topY = doorY + doorH;
  const botX = W / 2 - side * W * 0.30;
  const botY = H * 0.96;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = topX + (botX - topX) * t;
    const y = topY + (botY - topY) * t;
    const tw = 30 + t * 120; // tread widens toward the viewer
    const th = 6 + t * 10;
    ctx.fillStyle = `rgba(${30 + t * 14},${28 + t * 12},${26 + t * 10},1)`;
    ctx.fillRect(x - tw / 2, y, tw, th);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - tw / 2, y + th, tw, 3); // riser shadow
    // lit nosing on the door side
    ctx.fillStyle = "rgba(232,190,110,0.10)";
    ctx.fillRect(x - tw / 2, y, tw, 2);
  }

  // ---- rain puddle catching the doorlight, at the foot ----
  const pud = ctx.createRadialGradient(botX, botY, 4, botX, botY, 80);
  pud.addColorStop(0, "rgba(180,150,95,0.22)");
  pud.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = pud;
  ctx.beginPath();
  ctx.ellipse(botX, botY, 80, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- chalk outline of the fallen man at the foot of the stairs ----
  ctx.save();
  ctx.translate(botX, botY - 6);
  ctx.rotate(side * 0.5);
  ctx.strokeStyle = "rgba(225,228,230,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -22, 8, 0, Math.PI * 2); // head
  ctx.moveTo(-7, -15);
  ctx.lineTo(-18, 6); // torso/leg sprawl
  ctx.moveTo(-7, -15);
  ctx.lineTo(14, -4);
  ctx.moveTo(2, -12);
  ctx.lineTo(22, -16); // an arm flung out
  ctx.moveTo(2, -12);
  ctx.lineTo(-2, 14);
  ctx.stroke();
  ctx.restore();

  // ---- rain ----
  const drops = 120 + Math.floor(rng() * 120);
  ctx.strokeStyle = "rgba(200,210,225,0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < drops; i++) {
    const x = rng() * (W + 40) - 20;
    const y = rng() * H;
    const len = 8 + rng() * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + len);
    ctx.stroke();
  }

  // ---- vignette ----
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/** Paint (or repaint) the crime-scene texture for a seed. */
export function paintScene(scene: Phaser.Scene, key: string, seed: number): void {
  const tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(key, SW, SH);
  if (!tex) return;
  const ctx = tex.getContext();
  if (!ctx) return;
  ctx.clearRect(0, 0, SW, SH);
  drawScene(ctx, SW, SH, seed);
  tex.refresh();
}
