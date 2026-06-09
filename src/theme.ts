/**
 * AGAIN palette — Obsidian Codex meets clinical noir. Warm near-black stone,
 * aged-ivory ink, a blood-red blade for the pin, amber for what won't hold still.
 */
export const COLORS = {
  bg: 0x14110d,
  panel: 0x1f1a13,
  panelEdge: 0x3a3024,
  ink: 0xe7dcc3,
  muted: 0x9a8f7a,
  faint: 0x6b6151,
  crimson: 0xc0392b,
  crimsonBright: 0xe05a4a,
  amber: 0xd9a441,
  slate: 0x6b7a8f,
} as const;

export const CSS = {
  ink: "#e7dcc3",
  muted: "#9a8f7a",
  faint: "#6b6151",
  crimson: "#c0392b",
  crimsonBright: "#e05a4a",
  amber: "#d9a441",
  slate: "#8fa1b8",
} as const;

export const DISPLAY = "'Playfair Display', Georgia, serif";
export const BODY = "'Newsreader', Georgia, serif";
export const MONO = "'JetBrains Mono', 'Courier New', monospace";

import { textScaleValue } from "./game/save";

/** Scale a font size by the player's text-size setting. Use everywhere instead
 * of a raw "Npx" literal, so the whole UI grows for distance viewing. */
export function fs(px: number): string {
  return `${Math.round(px * textScaleValue())}px`;
}

/** The active text scale — for callers that also need to grow line spacing,
 * fixed offsets, or wrap widths alongside the font. */
export function uiScale(): number {
  return textScaleValue();
}
