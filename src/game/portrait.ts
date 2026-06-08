import Phaser from "phaser";
import { mulberry32 } from "./rng";

/**
 * A procedurally-drawn noir suspect portrait — no image files. The face is rolled
 * deterministically from the case seed (so a suspect looks the same all session),
 * and the expression is driven by `mood`, so the portrait reacts to the
 * interrogation: it averts the eyes when it deflects, sweats under pressure, and
 * slumps when the story breaks. Heavy single-source lighting and small size keep
 * it evocative rather than uncanny — it's a case-file photo under a desk lamp.
 */

export type Mood = "neutral" | "evasive" | "pressed" | "broken";

const SKINS = ["#b89678", "#a87f5f", "#8d6750", "#c6a585", "#6f5443", "#9c7a5e"];
const NAMES_FIRST = ["Earl", "Vance", "Roy", "Clyde", "Sol", "Marlon", "Gus", "Dex", "Hal", "Otis", "Lon", "Walt", "Cyril", "Mort", "Ray", "Niall"];
const NAMES_LAST = ["Voss", "Kane", "Doyle", "Mercer", "Frost", "Pryce", "Ackroyd", "Webb", "Hale", "Renn", "Lyle", "Crane", "Stahl", "Mott", "Briggs", "Glass"];

/** A stable display name for the suspect, from the same seed as the face. */
export function suspectName(seed: number): string {
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return `${NAMES_FIRST[Math.floor(r() * NAMES_FIRST.length)]} ${NAMES_LAST[Math.floor(r() * NAMES_LAST.length)]}`;
}

interface Face {
  skin: string;
  grey: number; // 0 dark hair .. 1 grey (age)
  headW: number; // half-width as fraction of W
  jaw: number; // chin width vs head
  hair: number; // 0 short 1 receding 2 slick 3 hat 4 bald
  brow: number; // brow thickness px
  eyeGap: number;
  eyeR: number;
  noseLen: number;
  mouthW: number;
  beard: number; // 0 none 1 stubble 2 moustache 3 full
  collar: string;
  tie: boolean;
  lit: number; // -1 lit from left, +1 from right
}

function rollFace(rng: () => number): Face {
  const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];
  return {
    skin: pick(SKINS),
    grey: rng() < 0.32 ? 0.4 + rng() * 0.6 : 0,
    headW: 0.30 + rng() * 0.06,
    jaw: 0.66 + rng() * 0.24,
    hair: Math.floor(rng() * 5),
    brow: 3 + rng() * 3,
    eyeGap: 0.20 + rng() * 0.05,
    eyeR: 7 + rng() * 2.5,
    noseLen: 26 + rng() * 16,
    mouthW: 30 + rng() * 14,
    beard: rng() < 0.5 ? 0 : Math.floor(1 + rng() * 3),
    collar: ["#1a1712", "#241d16", "#15110d", "#20242a"][Math.floor(rng() * 4)],
    tie: rng() < 0.6,
    lit: rng() < 0.5 ? -1 : 1,
  };
}

interface Expr {
  gazeX: number;
  gazeY: number;
  lid: number; // 0 open .. 1 shut
  browY: number; // furrow/raise px
  mouth: number; // -1 frown .. 0 flat .. shape
  open: number; // mouth openness
  sweat: number; // drops
  tilt: number; // head tilt radians (drawn straight; scene tilts the sprite)
}
function exprFor(mood: Mood): Expr {
  switch (mood) {
    case "evasive":
      return { gazeX: -0.7, gazeY: -0.1, lid: 0.18, browY: -1.5, mouth: -0.2, open: 0, sweat: 0, tilt: 0 };
    case "pressed":
      return { gazeX: 0.15, gazeY: -0.05, lid: 0, browY: 2.5, mouth: -0.7, open: 0.05, sweat: 3, tilt: 0 };
    case "broken":
      return { gazeX: -0.2, gazeY: 0.7, lid: 0.6, browY: 1, mouth: -0.4, open: 0.35, sweat: 2, tilt: 0 };
    default:
      return { gazeX: 0, gazeY: 0, lid: 0.05, browY: 0, mouth: -0.05, open: 0, sweat: 0, tilt: 0 };
  }
}

const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + f));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + f));
  const b = Math.max(0, Math.min(255, (n & 255) + f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

export function drawPortrait(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, mood: Mood): void {
  const f = rollFace(mulberry32(seed >>> 0));
  const e = exprFor(mood);
  const cx = W / 2;
  const headTop = H * 0.2;
  const chinY = H * 0.76;
  const faceH = chinY - headTop;
  const hw = f.headW * W; // head half-width
  const midY = headTop + faceH * 0.46;
  const hairCol = shade("#12100c", Math.round(f.grey * 110));

  // ---- backdrop: a dark cell with a spill of lamp light behind the head ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b1610");
  bg.addColorStop(1, "#0d0b08");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(cx, midY, 8, cx, midY, hw * 2.4);
  halo.addColorStop(0, "rgba(217,164,65,0.16)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  // faint mugshot height ticks
  ctx.strokeStyle = "rgba(180,160,120,0.06)";
  ctx.lineWidth = 1;
  for (let y = headTop; y < H; y += 26) {
    ctx.beginPath();
    ctx.moveTo(W - 14, y);
    ctx.lineTo(W - 6, y);
    ctx.stroke();
  }

  // ---- shoulders / coat ----
  ctx.fillStyle = f.collar;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 1.7, H);
  ctx.quadraticCurveTo(cx - hw * 0.9, chinY + faceH * 0.12, cx - hw * 0.5, chinY + faceH * 0.02);
  ctx.lineTo(cx + hw * 0.5, chinY + faceH * 0.02);
  ctx.quadraticCurveTo(cx + hw * 0.9, chinY + faceH * 0.12, cx + hw * 1.7, H);
  ctx.closePath();
  ctx.fill();
  if (f.tie) {
    ctx.fillStyle = "#3a2c20";
    ctx.beginPath();
    ctx.moveTo(cx, chinY + faceH * 0.04);
    ctx.lineTo(cx - 9, H);
    ctx.lineTo(cx + 9, H);
    ctx.closePath();
    ctx.fill();
  }

  // ---- neck ----
  ctx.fillStyle = shade(f.skin, -34);
  ctx.fillRect(cx - hw * 0.32, chinY - faceH * 0.06, hw * 0.64, faceH * 0.22);

  // ---- head (jaw narrows to chin) ----
  const headPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - hw, midY - faceH * 0.06);
    ctx.quadraticCurveTo(cx - hw, headTop, cx, headTop); // up to crown left
    ctx.quadraticCurveTo(cx + hw, headTop, cx + hw, midY - faceH * 0.06); // crown right
    ctx.quadraticCurveTo(cx + hw * 0.96, midY + faceH * 0.2, cx + hw * f.jaw, chinY - faceH * 0.12);
    ctx.quadraticCurveTo(cx + hw * 0.4, chinY, cx, chinY); // chin
    ctx.quadraticCurveTo(cx - hw * 0.4, chinY, cx - hw * f.jaw, chinY - faceH * 0.12);
    ctx.quadraticCurveTo(cx - hw * 0.96, midY + faceH * 0.2, cx - hw, midY - faceH * 0.06);
    ctx.closePath();
  };
  ctx.fillStyle = f.skin;
  headPath();
  ctx.fill();

  // ears
  ctx.fillStyle = shade(f.skin, -10);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * hw * 0.98, midY, hw * 0.12, faceH * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- hard noir shadow over the unlit half ----
  ctx.save();
  headPath();
  ctx.clip();
  const sx = f.lit; // shadow falls opposite the light
  const sg = ctx.createLinearGradient(cx - sx * hw, 0, cx + sx * hw, 0);
  sg.addColorStop(0, "rgba(0,0,0,0)");
  sg.addColorStop(0.5, "rgba(0,0,0,0.05)");
  sg.addColorStop(0.72, "rgba(8,6,4,0.5)");
  sg.addColorStop(1, "rgba(4,3,2,0.74)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  // lit-side cheekbone highlight
  const hg = ctx.createRadialGradient(cx - sx * hw * 0.5, midY + 6, 4, cx - sx * hw * 0.5, midY + 6, hw);
  hg.addColorStop(0, "rgba(240,214,150,0.22)");
  hg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ---- brows ----
  const eyeY = midY - faceH * 0.02;
  const ex = f.eyeGap * W;
  ctx.strokeStyle = hairCol;
  ctx.lineWidth = f.brow;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    const raise = s < 0 && mood === "evasive" ? -3 : 0; // a cocked brow when evasive
    ctx.beginPath();
    ctx.moveTo(cx + s * ex - f.eyeR, eyeY - f.eyeR - 3 + e.browY + raise);
    ctx.lineTo(cx + s * ex + f.eyeR, eyeY - f.eyeR - 4 + e.browY * 0.6 + raise);
    ctx.stroke();
  }

  // ---- eyes ----
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    // socket shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, eyeY, f.eyeR + 3, f.eyeR + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    // sclera
    ctx.fillStyle = "#cabf9f";
    ctx.beginPath();
    ctx.ellipse(x, eyeY, f.eyeR, f.eyeR * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // iris
    ctx.fillStyle = "#241a12";
    ctx.beginPath();
    ctx.arc(x + e.gazeX * f.eyeR * 0.6, eyeY + e.gazeY * f.eyeR * 0.4, f.eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // lid (skin) drops from the top by e.lid
    if (e.lid > 0.01) {
      ctx.fillStyle = shade(f.skin, -6);
      ctx.fillRect(x - f.eyeR - 1, eyeY - f.eyeR * 0.62 - 1, f.eyeR * 2 + 2, f.eyeR * 1.24 * e.lid + 1);
    }
    // lower lid line
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - f.eyeR, eyeY + f.eyeR * 0.5);
    ctx.lineTo(x + f.eyeR, eyeY + f.eyeR * 0.5);
    ctx.stroke();
  }

  // ---- nose ----
  const noseTip = eyeY + f.noseLen;
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - f.lit * 3, eyeY + 4);
  ctx.lineTo(cx - f.lit * 7, noseTip);
  ctx.quadraticCurveTo(cx, noseTip + 5, cx + 6, noseTip - 1);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx - 5, noseTip + 1, 2.2, 1.6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 4, noseTip + 1, 2.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- mouth ----
  const mouthY = noseTip + faceH * 0.13;
  const mw = f.mouthW;
  ctx.strokeStyle = "rgba(40,20,16,0.7)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - mw / 2, mouthY);
  ctx.quadraticCurveTo(cx, mouthY + e.mouth * 8, cx + mw / 2, mouthY);
  ctx.stroke();
  if (e.open > 0.02) {
    ctx.fillStyle = "rgba(20,8,8,0.8)";
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2, mw * 0.32, e.open * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- facial hair ----
  if (f.beard === 1 || f.beard === 3) {
    ctx.fillStyle = "rgba(20,16,12," + (f.beard === 3 ? 0.85 : 0.28) + ")";
    ctx.beginPath();
    ctx.moveTo(cx - hw * f.jaw, chinY - faceH * 0.14);
    ctx.quadraticCurveTo(cx, chinY + 6, cx + hw * f.jaw, chinY - faceH * 0.14);
    ctx.quadraticCurveTo(cx, mouthY + (f.beard === 3 ? 2 : 10), cx - hw * f.jaw, chinY - faceH * 0.14);
    ctx.fill();
  }
  if (f.beard === 2 || f.beard === 3) {
    ctx.strokeStyle = "rgba(20,16,12,0.85)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - mw * 0.6, mouthY - 6);
    ctx.quadraticCurveTo(cx, mouthY - 2, cx + mw * 0.6, mouthY - 6);
    ctx.stroke();
  }

  // ---- hair / hat ----
  ctx.fillStyle = hairCol;
  if (f.hair === 3) {
    // fedora: band shadow across the brow
    ctx.beginPath();
    ctx.moveTo(cx - hw * 1.25, headTop + faceH * 0.16);
    ctx.quadraticCurveTo(cx, headTop - faceH * 0.16, cx + hw * 1.25, headTop + faceH * 0.16);
    ctx.quadraticCurveTo(cx, headTop + faceH * 0.05, cx - hw * 1.25, headTop + faceH * 0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.92, headTop + faceH * 0.08);
    ctx.quadraticCurveTo(cx, headTop - faceH * 0.34, cx + hw * 0.92, headTop + faceH * 0.08);
    ctx.lineTo(cx + hw * 0.92, headTop + faceH * 0.02);
    ctx.quadraticCurveTo(cx, headTop - faceH * 0.18, cx - hw * 0.92, headTop + faceH * 0.02);
    ctx.fill();
    // brim shadow over eyes
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(cx - hw, headTop + faceH * 0.12, hw * 2, faceH * 0.16);
  } else if (f.hair !== 4) {
    ctx.beginPath();
    ctx.moveTo(cx - hw * 1.02, midY - faceH * 0.05);
    const recede = f.hair === 1 ? faceH * 0.08 : 0;
    ctx.quadraticCurveTo(cx - hw, headTop - faceH * 0.08, cx, headTop - faceH * 0.06 + recede);
    ctx.quadraticCurveTo(cx + hw, headTop - faceH * 0.08, cx + hw * 1.02, midY - faceH * 0.05);
    if (f.hair === 1) {
      // receding: dip the hairline at the temples
      ctx.quadraticCurveTo(cx + hw * 0.7, headTop + faceH * 0.06, cx + hw * 0.42, headTop + faceH * 0.02);
      ctx.quadraticCurveTo(cx, headTop + faceH * 0.16, cx - hw * 0.42, headTop + faceH * 0.02);
      ctx.quadraticCurveTo(cx - hw * 0.7, headTop + faceH * 0.06, cx - hw * 1.02, midY - faceH * 0.05);
    } else {
      ctx.quadraticCurveTo(cx + hw * 0.9, headTop + faceH * (f.hair === 2 ? 0.04 : 0.02), cx + hw * 0.5, headTop + faceH * (f.hair === 2 ? -0.02 : 0.06));
      ctx.quadraticCurveTo(cx, headTop + faceH * (f.hair === 2 ? -0.06 : 0.1), cx - hw * 0.5, headTop + faceH * (f.hair === 2 ? -0.02 : 0.06));
      ctx.quadraticCurveTo(cx - hw * 0.9, headTop + faceH * (f.hair === 2 ? 0.04 : 0.02), cx - hw * 1.02, midY - faceH * 0.05);
    }
    ctx.fill();
  }

  // ---- sweat under pressure ----
  if (e.sweat > 0) {
    for (let i = 0; i < e.sweat; i++) {
      const dx = cx - f.lit * (hw * 0.5) + (i - 1) * 10;
      const dy = headTop + faceH * 0.28 + i * 12;
      const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, 4);
      g.addColorStop(0, "rgba(245,240,225,0.85)");
      g.addColorStop(1, "rgba(245,240,225,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 2.4, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // vignette the photo edges
  const vg = ctx.createRadialGradient(cx, H * 0.45, H * 0.3, cx, H * 0.45, H * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

const PW = 220;
const PH = 280;

/** Paint (or repaint) a portrait texture in place, so mood changes update it. */
export function paintPortrait(scene: Phaser.Scene, key: string, seed: number, mood: Mood): void {
  let tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(key, PW, PH);
  if (!tex) return;
  const ctx = tex.getContext();
  if (!ctx) return;
  ctx.clearRect(0, 0, PW, PH);
  drawPortrait(ctx, PW, PH, seed, mood);
  tex.refresh();
}
