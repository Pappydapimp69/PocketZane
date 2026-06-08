import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

/**
 * All art in AGAIN is generated at runtime — no image files. These build a
 * paper-grain noise tile, an interrogation-lamp glow, and an edge vignette,
 * once, into the texture manager. Guarded so a headless context degrades to
 * flat color instead of throwing.
 */
export function generateTextures(scene: Phaser.Scene): void {
  makeNoise(scene, "grain", 220);
  makeLamp(scene, "lamp", 360, 240);
  makeVignette(scene, "vignette", GAME_WIDTH, GAME_HEIGHT);
}

function makeNoise(scene: Phaser.Scene, key: string, size: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex?.getContext();
  if (!ctx || !tex) return;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.floor(Math.random() * 55);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.5 ? 14 : 0; // sparse specks
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

function makeLamp(scene: Phaser.Scene, key: string, w: number, h: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!ctx || !tex) return;
  const g = ctx.createRadialGradient(w / 2, h * 0.1, 8, w / 2, h * 0.1, h);
  g.addColorStop(0, "rgba(245,222,160,0.16)");
  g.addColorStop(0.4, "rgba(217,164,65,0.07)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
}

function makeVignette(scene: Phaser.Scene, key: string, w: number, h: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!ctx || !tex) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
}

/** Lay the generated atmosphere into a scene: grain, optional lamp, vignette. */
export function addAtmosphere(scene: Phaser.Scene, opts: { lamp?: boolean } = {}): void {
  if (scene.textures.exists("grain")) {
    scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setDepth(-1).setAlpha(0.5);
  }
  if (opts.lamp && scene.textures.exists("lamp")) {
    scene.add.image(GAME_WIDTH / 2, 0, "lamp").setOrigin(0.5, 0).setDepth(-1);
  }
  if (scene.textures.exists("vignette")) {
    scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette").setDepth(90);
  }
}
