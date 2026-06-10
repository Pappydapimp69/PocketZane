import { WebCase, WebInquiry } from "./web";

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

/**
 * Patch-aware verification: the static fixpoint above proves the *unpatched* web,
 * but the game ships with the patch mechanic LIVE in the confrontation — cornered,
 * the suspect spins fresh lies that re-cover the hole. This drives the real
 * `WebInquiry` with `patch` on, exactly as the confrontation does, and confirms
 * the case still (a) terminates — the patching is bounded, no infinite scramble —
 * and (b) solves. So the configuration that actually ships is the one we gate on.
 *
 * Patch structure is deterministic (only the claim *text* is seeded), so
 * solvability is seed-independent; we drive one run with a fixed seed. The cap is
 * generous — far above any legitimate playthrough — so blowing it means a trap.
 */
export interface PatchedVerifyResult {
  solvable: boolean;
  terminates: boolean;
  patches: number; // how many fresh lies he threw on the way down
}

export function verifyWebPatched(web: WebCase, startLeads: string[]): PatchedVerifyResult {
  const inq = new WebInquiry(web, 1, startLeads, [], true);
  const cap = (web.segments.length + 4) * (web.evidence.length + 4) + 200;
  let patches = 0;
  let changed = true;
  let iters = 0;
  while (!inq.solved && changed && iters < cap) {
    changed = false;
    for (const e of inq.heldEvidence()) {
      const r = inq.present(e.id);
      if (r.kind === "deflect" || r.kind === "break") changed = true;
      if (r.kind === "break" && r.patched) patches += 1;
      iters += 1;
      if (inq.solved) break;
    }
  }
  // terminated cleanly if we reached a stable state (or a win) under the cap
  return { solvable: inq.solved, terminates: iters < cap, patches };
}
