/**
 * Subject temperaments. Each one tilts how the interrogation behaves — how
 * readily a lie slips, how pressure helps, how easily composure returns — so
 * different subjects want a different approach. The hint is shown to the player
 * as the first read on whoever just sat down.
 */
export interface Temperament {
  id: string;
  label: string;
  hint: string;
  slip: number; // base chance an unstable line slips
  boost: number; // how much pressure adds to slip
  recoverAt: number; // pressure at which composure resets (>100 = never)
  pressGain: number; // how much a single PRESS destabilizes a line
}

export const TEMPERAMENTS: Record<string, Temperament> = {
  steady: { id: "steady", label: "ordinary", hint: "nothing unusual — work it straight.", slip: 0.32, boost: 0.28, recoverAt: 92, pressGain: 0.5 },
  nervous: { id: "nervous", label: "rattled", hint: "talks too much — it'll slip on its own.", slip: 0.46, boost: 0.3, recoverAt: 200, pressGain: 0.45 },
  guarded: { id: "guarded", label: "guarded", hint: "gives little — lean on it, find the file.", slip: 0.18, boost: 0.22, recoverAt: 86, pressGain: 0.7 },
  cool: { id: "cool", label: "composed", hint: "steadies fast — catch it and move quick.", slip: 0.34, boost: 0.26, recoverAt: 68, pressGain: 0.42 },
};

const KEYS = Object.keys(TEMPERAMENTS);

export function randomTemperament(rng: () => number = Math.random): Temperament {
  return TEMPERAMENTS[KEYS[Math.floor(rng() * KEYS.length)]];
}
