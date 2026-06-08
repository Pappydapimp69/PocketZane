import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { getReduceMotion } from "./save";

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
  makeMote(scene, "mote", 24);
  makeRaindrop(scene, "raindrop", 3, 26);
  makeBlinds(scene, "blinds", GAME_WIDTH, GAME_HEIGHT);
}

/** Venetian-blind light bars slanting across the dark — pure noir staging. */
function makeBlinds(scene: Phaser.Scene, key: string, w: number, h: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!ctx || !tex) return;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.12);
  ctx.translate(-w / 2, -h * 0.9);
  const band = 34;
  for (let y = 0; y < h * 1.9; y += band) {
    const g = ctx.createLinearGradient(0, y, 0, y + band * 0.5);
    g.addColorStop(0, "rgba(232,200,128,0.10)");
    g.addColorStop(1, "rgba(232,200,128,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-40, y, w + 80, band * 0.5);
  }
  ctx.restore();
  tex.refresh();
}

/** A thin vertical streak — a single fall of rain on glass. */
function makeRaindrop(scene: Phaser.Scene, key: string, w: number, h: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!ctx || !tex) return;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(200,212,228,0)");
  g.addColorStop(0.6, "rgba(200,212,228,0.5)");
  g.addColorStop(1, "rgba(220,230,245,0.8)");
  ctx.fillStyle = g;
  ctx.fillRect(w / 2 - 0.5, 0, 1, h);
  tex.refresh();
}

/** A sheet of rain falling across the scene — depth-sorted faint, for atmosphere. */
export function addRain(scene: Phaser.Scene, depth = 88, quantity = 2): void {
  if (!scene.textures.exists("raindrop") || getReduceMotion()) return;
  scene.add
    .particles(0, -20, "raindrop", {
      x: { min: -20, max: GAME_WIDTH + 20 },
      y: -20,
      speedY: { min: 620, max: 920 },
      speedX: { min: -40, max: -20 },
      lifespan: 1500,
      scaleX: { min: 0.6, max: 1.1 },
      scaleY: { min: 0.7, max: 1.6 },
      alpha: { min: 0.08, max: 0.22 },
      frequency: 40,
      quantity,
    })
    .setDepth(depth);
}

/** A soft round dot — a dust mote catching the lamp. */
function makeMote(scene: Phaser.Scene, key: string, size: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex?.getContext();
  if (!ctx || !tex) return;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(245,235,205,0.9)");
  g.addColorStop(1, "rgba(245,235,205,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
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

/**
 * Lay the generated atmosphere into a scene: grain, optional lamp, vignette.
 * Returns the lamp image so a scene can make it react (it breathes with pressure).
 */
export function addAtmosphere(
  scene: Phaser.Scene,
  opts: { lamp?: boolean } = {},
): { lamp?: Phaser.GameObjects.Image } {
  const reduced = getReduceMotion();
  if (scene.textures.exists("grain")) {
    // Living film grain — drifts slowly so it never sits still (still if motion reduced).
    const grain = scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setDepth(-1).setAlpha(0.5);
    if (!reduced) {
      scene.tweens.add({ targets: grain, tilePositionY: "+=220", duration: 8000, repeat: -1 });
      scene.tweens.add({ targets: grain, alpha: { from: 0.42, to: 0.58 }, duration: 2400, yoyo: true, repeat: -1 });
    }
  }
  let lamp: Phaser.GameObjects.Image | undefined;
  if (opts.lamp && scene.textures.exists("lamp")) {
    lamp = scene.add.image(GAME_WIDTH / 2, 0, "lamp").setOrigin(0.5, 0).setDepth(-1);
    if (scene.textures.exists("mote") && !reduced) {
      // Dust turning over in the cone of light.
      scene.add
        .particles(GAME_WIDTH / 2, 24, "mote", {
          x: { min: -150, max: 150 },
          y: { min: 0, max: 30 },
          speedY: { min: 4, max: 13 },
          speedX: { min: -5, max: 5 },
          lifespan: 12000,
          scale: { min: 0.18, max: 0.55 },
          alpha: { start: 0.12, end: 0 },
          frequency: 700,
          quantity: 1,
          blendMode: "ADD",
        })
        .setDepth(-1);
    }
  }
  if (scene.textures.exists("vignette")) {
    scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette").setDepth(90);
  }
  return { lamp };
}
