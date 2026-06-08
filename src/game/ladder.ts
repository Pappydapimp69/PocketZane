/**
 * Difficulty ladder + seeding for the integrated engine (step 10). The generator
 * has knobs — how many supports prop the alibi, whether one is propped by a
 * deeper support, and the weirdness dial (which doubles as the chance a case is
 * built around a keystone bluff). This maps a "night" number onto those knobs so
 * endless play deepens, and pins the daily to a calendar seed so everyone gets
 * the same subject. Pure and deterministic; tested in scripts/test-ladder.ts.
 */
import type { GenOpts } from "./generateweb";
import { mulberry32 } from "./rng";

/** A seed fixed to the calendar day — the daily is the same for everyone. */
export function dailySeed(d: Date = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** A fresh, unpredictable seed — so a one-off case is never the same twice. */
export function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    (globalThis.crypto as Crypto).getRandomValues(a);
    if (a[0]) return a[0] >>> 0;
  } catch {
    /* no crypto — fall through */
  }
  return ((Math.floor(Math.random() * 0x100000000) ^ Date.now()) >>> 0) || 1;
}

/**
 * A varied one-off case: structure and weirdness scatter with the seed, so two
 * plays differ in size and shape, not just wording. Derived from the seed so the
 * same seed always rebuilds the same case.
 */
export function freeOpts(seed: number): GenOpts {
  const r = mulberry32(seed >>> 0);
  const supports = r() < 0.4 ? 3 : 2; // 2 or 3 props
  const depth = r() < 0.4 ? 2 : 1; // sometimes one prop stands on another
  const weirdness = 0.2 + r() * 0.4; // 0.2–0.6 chance it's a keystone bluff
  return { supports, depth, weirdness, herring: true };
}

/** The daily plays at a fair middle difficulty, same shape for all. */
export const DAILY_OPTS: GenOpts = { supports: 2, depth: 1, weirdness: 0.2, herring: true };

/**
 * Endless difficulty by night (1-based). Early nights are flat and small; the
 * web widens (more supports), then deepens (a propped support), and the weirder
 * it gets the more often the night hides a keystone.
 */
export function optsForNight(night: number): GenOpts {
  const n = Math.max(1, Math.floor(night));
  const supports = Math.min(3, 1 + Math.floor(n / 2)); // 1,1,2,2,3,3,...
  const depth = n >= 4 ? 2 : 1;
  const weirdness = Math.min(0.6, n <= 2 ? 0 : (n - 2) * 0.12);
  const herring = n >= 3;
  return { supports, depth, weirdness, herring };
}

/** A per-night seed for an endless run that began at `runBase`. */
export function nightSeed(runBase: number, night: number): number {
  return (runBase + Math.imul(night, 2654435761)) >>> 0;
}
