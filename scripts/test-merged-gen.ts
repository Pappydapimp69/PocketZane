/**
 * The full generator: a generated case = generated phases + web. Across seeds it
 * must be structurally sound and winnable (clearing phases AND failing them all).
 * Run: npx tsx scripts/test-merged-gen.ts
 */
import { generateMergedCase } from "../src/game/generateweb";
import { MergedInquiry } from "../src/game/merged";

let ok = true;
const fail = (m: string) => {
  ok = false;
  console.log("✗ " + m);
};

let n = 0;
for (let seed = 1; seed <= 120; seed++) {
  const c = generateMergedCase(seed, { weirdness: 0.5, herring: true });
  n++;

  // structure: 1..3 phases, each with exactly one lie that yields a web evidence id
  const evIds = new Set(c.web.evidence.map((e) => e.id));
  if (c.phases.length < 1 || c.phases.length > 3) fail(`seed ${seed}: ${c.phases.length} phases`);
  for (const p of c.phases) {
    const lies = p.statements.filter((s) => s.lie);
    if (lies.length !== 1) fail(`seed ${seed}/${p.id}: ${lies.length} lies`);
    if (lies[0] && !evIds.has(lies[0].lie!.lead)) fail(`seed ${seed}/${p.id}: lead not a web evidence`);
    if (p.statements.length !== 3) fail(`seed ${seed}/${p.id}: ${p.statements.length} statements`);
  }
  if (!c.startLeads.every((id) => evIds.has(id))) fail(`seed ${seed}: bad startLeads`);

  // winnable: clear every phase, then play the web with everything in hand
  const win = (failPhases: boolean) => {
    const q = new MergedInquiry(c, seed);
    while (!q.confronting) {
      if (!failPhases) {
        const lie = q.phaseLines().find((l) => l.isLie)!;
        q.question(lie.id);
        q.pin(lie.id);
      } else {
        // strike out: pin truths until the phase ends
        let guard = 0;
        while (!q.phaseOver && guard++ < 10) {
          const t = q.phaseLines().find((l) => !l.isLie && !l.pinned);
          if (t) q.pin(t.id);
          else break;
        }
      }
      q.advance();
    }
    // confrontation: greedily present everything to a fixpoint
    let changed = true;
    let guard = 0;
    while (!q.solved && changed && guard++ < 60) {
      changed = false;
      for (const e of q.heldEvidence()) {
        const r = q.present(e.id);
        if (r.kind === "deflect" || r.kind === "break") changed = true;
        if (q.solved) break;
      }
    }
    return q.solved;
  };

  if (!win(false)) fail(`seed ${seed}: not winnable after clearing phases`);
  if (!win(true)) fail(`seed ${seed}: not winnable after FAILING every phase`);
}

// determinism
if (JSON.stringify(generateMergedCase(7)) !== JSON.stringify(generateMergedCase(7))) fail("non-deterministic");

console.log(`\ngenerated ${n} full cases`);
console.log(ok ? "Full generator OK — phases sound, winnable both ways." : "FULL GENERATOR BROKEN.");
process.exit(ok ? 0 : 1);
