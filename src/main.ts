import Phaser from "phaser";
import { gameConfig } from "./config";

/** Wait for the webfonts (briefly) so the first paint isn't a fallback flash. */
async function boot(): Promise<void> {
  try {
    await Promise.race([
      (document as any).fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fonts optional — fall back to serif */
  }
  (window as any).__game = new Phaser.Game(gameConfig);
}

void boot();
