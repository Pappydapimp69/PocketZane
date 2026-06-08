import { WebCase } from "./web";

/**
 * Solvability verifier for the constraint web. The confrontation is monotone:
 * presenting a lead either breaks a segment or (by leaning on a support) reveals
 * the lead that breaks that support — held evidence and broken segments only ever
 * grow. So winnability is a fixpoint: repeatedly break what you can and reveal
 * what you can, until stable, then check every key segment is down.
 *
 * We verify from the *minimum* hand (just the start leads — i.e. having failed
 * every phase). If that's solvable, the case is winnable no matter how the phases
 * go, since gathering more leads only ever helps. This is the gate the generator
 * runs on every candidate case.
 */
export interface VerifyResult {
  solvable: boolean;
  order: string[]; // segment ids in the order they break (for diagrams / debugging)
}

export function verifyWeb(web: WebCase, startLeads: string[]): VerifyResult {
  const held = new Set(startLeads);
  const broken = new Set<string>();
  const order: string[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of web.evidence) {
      if (!held.has(e.id)) continue;
      const t = e.targets;
      if (broken.has(t)) continue;
      const intact = e.deflectableBy.filter((d) => !broken.has(d));
      if (intact.length === 0) {
        broken.add(t);
        order.push(t);
        changed = true;
      } else {
        // Leaning on a support reveals the lead that breaks it (recovery).
        const via = intact[0];
        const breaker = web.evidence.find((x) => x.targets === via && !held.has(x.id));
        if (breaker) {
          held.add(breaker.id);
          changed = true;
        }
      }
    }
  }

  const keys = web.segments.filter((s) => s.key).map((s) => s.id);
  return { solvable: keys.every((k) => broken.has(k)), order };
}
