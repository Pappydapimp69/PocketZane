/**
 * Generative deflection phrasing: two attacks through the same support read
 * differently (the old "same sentence" bug), pools are internally distinct, and
 * it's deterministic. Run: npx tsx scripts/test-phrasing.ts
 */
import { generateWeb } from "../src/game/generateweb";

let ok = true;
const check = (p: boolean, m: string) => {
  if (!p) ok = false;
  console.log(`${p ? "✓" : "✗"} ${m}`);
};

let sameLineCollisions = 0;
let sampled = 0;
for (let seed = 1; seed <= 80; seed++) {
  const web = generateWeb(seed, { supports: 2, keystone: false });
  const homeAttacks = web.evidence.filter((e) => e.targets === "home");
  if (homeAttacks.length < 2) continue;
  const supId = homeAttacks[0].deflectableBy[0];
  const p1 = web.deflections[`${homeAttacks[0].id}:${supId}`];
  const p2 = web.deflections[`${homeAttacks[1].id}:${supId}`];
  if (!p1 || !p2) {
    check(false, `seed ${seed}: missing deflection pools`);
    continue;
  }
  sampled++;
  if (p1[0] === p2[0]) sameLineCollisions++;
  if (new Set(p1).size !== p1.length) check(false, `seed ${seed}: pool has duplicate lines`);
  if (!p1.every((l) => /[.!]$/.test(l))) check(false, `seed ${seed}: malformed line`);
}
check(sameLineCollisions === 0, `no two-attacks-same-line collisions across ${sampled} cases (was the bug)`);

// determinism
{
  const a = generateWeb(9, { supports: 2, keystone: false }).deflections;
  const b = generateWeb(9, { supports: 2, keystone: false }).deflections;
  check(JSON.stringify(a) === JSON.stringify(b), "deflection phrasing is deterministic by seed");
}

console.log(ok ? "\nPhrasing OK — deflections are varied, attack-aware, deterministic." : "\nPHRASING BROKEN.");
process.exit(ok ? 0 : 1);
