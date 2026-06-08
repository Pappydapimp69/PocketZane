/**
 * Stress the move generator: across many seeds and difficulty settings every
 * generated web must (a) verify solvable, (b) be structurally sound, and the
 * generator must be deterministic. Run: npx tsx scripts/test-generate.ts
 */
import { generateWeb, GenOpts } from "../src/game/generateweb";
import { verifyWeb } from "../src/game/verify";

let ok = true;
const fail = (m: string) => {
  ok = false;
  console.log("✗ " + m);
};

const configs: GenOpts[] = [{ keystone: true }, { keystone: true, herring: true }];
for (const supports of [1, 2, 3]) for (const depth of [1, 2]) for (const herring of [false, true]) configs.push({ supports, depth, herring });

let n = 0;
let unsolvable = 0;
let structErr = 0;
for (let seed = 1; seed <= 200; seed++) {
  for (const cfg of configs) {
    let web;
    try {
      web = generateWeb(seed, cfg);
    } catch (e) {
      fail(`seed ${seed} ${JSON.stringify(cfg)}: generator threw (${(e as Error).message})`);
      continue;
    }
    n++;
    const segIds = new Set(web.segments.map((s) => s.id));
    const evIds = new Set(web.evidence.map((e) => e.id));

    if (!web.segments.some((s) => s.key)) structErr++, fail(`seed ${seed}: no key segment`);
    if (web.startEvidence.length === 0 || !web.startEvidence.every((id) => evIds.has(id))) structErr++, fail(`seed ${seed}: bad startEvidence`);
    for (const e of web.evidence) {
      if (!segIds.has(e.targets)) structErr++, fail(`seed ${seed}: evidence ${e.id} targets missing segment`);
      for (const d of e.deflectableBy) if (!segIds.has(d)) structErr++, fail(`seed ${seed}: deflectableBy ${d} missing`);
    }
    for (const s of web.segments) if (!(s.id in web.concessions)) structErr++, fail(`seed ${seed}: no concession for ${s.id}`);
    // every wired (attack -> support) edge has deflection phrasing
    for (const e of web.evidence) for (const d of e.deflectableBy) if (!web.deflections[`${e.id}:${d}`]) structErr++, fail(`seed ${seed}: missing deflection ${e.id}:${d}`);

    if (!verifyWeb(web, web.startEvidence).solvable) unsolvable++, fail(`seed ${seed} ${JSON.stringify(cfg)}: UNSOLVABLE`);
  }
}

// determinism
{
  const a = JSON.stringify(generateWeb(42, { supports: 2, depth: 2 }));
  const b = JSON.stringify(generateWeb(42, { supports: 2, depth: 2 }));
  if (a !== b) fail("same seed produced different cases (non-deterministic)");
}

console.log(`\ngenerated ${n} cases · unsolvable ${unsolvable} · structural errors ${structErr}`);
console.log(ok ? "Generator OK — every case solvable and sound." : "GENERATOR BROKEN.");
process.exit(ok ? 0 : 1);
