/**
 * Sanity checks for the interrogation engine. Run: npx tsx scripts/test-engine.ts
 *   1. A constant line is never a valid pin (truth can't be "caught").
 *   2. Pinning a lie before it has moved is rejected ("not-yet").
 *   3. Every case is winnable by repeating until enough lies have slipped.
 */
import { Interrogation } from "../src/game/engine";
import { CASES } from "../src/game/cases";

let ok = true;
const log = (pass: boolean, msg: string) => {
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg}`);
};

for (const c of CASES) {
  const lieIds = c.statements.filter((s) => s.variants).map((s) => s.id);
  const constIds = c.statements.filter((s) => !s.variants).map((s) => s.id);

  // 1. constants are never validly pinnable.
  {
    const g = new Interrogation(c);
    for (let i = 0; i < 50; i++) g.again();
    const anyConstPinnable = constIds.some((id) => g.pin(id).kind === "pinned");
    log(!anyConstPinnable, `${c.id}: constants never pinnable`);
  }

  // 2. pinning a lie before it moves is rejected.
  {
    const g = new Interrogation(c, () => 1); // rng=1 → never slips
    const first = lieIds[0];
    log(g.pin(first).kind === "not-yet", `${c.id}: un-caught lie rejected`);
  }

  // 3. winnable: repeat until enough lies caught, then pin them.
  {
    const g = new Interrogation(c);
    let guard = 0;
    const caught = new Set<string>();
    while (caught.size < c.pinsToBreak && guard++ < 200) {
      g.again().forEach((id) => caught.add(id));
    }
    let broke = false;
    for (const id of caught) {
      const r = g.pin(id);
      if (r.kind === "pinned" && r.broke) broke = true;
    }
    log(broke, `${c.id}: winnable (caught ${caught.size}/${lieIds.length} lies)`);
  }
}

console.log(ok ? "\nAll engine checks passed." : "\nENGINE CHECKS FAILED.");
process.exit(ok ? 0 : 1);
