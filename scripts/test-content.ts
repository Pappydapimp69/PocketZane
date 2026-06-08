/**
 * Generative content (claims, concessions, the alibi core, phase shifts, truths)
 * must actually VARY across seeds — the whole point is two cases no longer read
 * the same — while staying deterministic per seed and structurally intact. Run:
 * npx tsx scripts/test-content.ts
 */
import { generateMergedCase } from "../src/game/generateweb";

let ok = true;
const check = (p: boolean, m: string) => {
  if (!p) ok = false;
  console.log(`${p ? "✓" : "✗"} ${m}`);
};

// Across many seeds, how many distinct alibi headlines / first phase-lies / first
// truths do we see? Fixed strings would give 1; the grammar should give several.
const homeClaims = new Set<string>();
const phaseLies = new Set<string>();
const phaseTruths = new Set<string>();
const concessions = new Set<string>();
const briefWhat = new Set<string>();
const briefWhy = new Set<string>();
const briefGoal = new Set<string>();
const motives = new Set<string>();
for (let seed = 1; seed <= 200; seed++) {
  const c = generateMergedCase(seed, { supports: 2, depth: 1, weirdness: 0.2, herring: true });
  const home = c.web.segments.find((s) => s.id === "home")!;
  homeClaims.add(home.base);
  concessions.add(c.web.concessions["home"]);
  briefWhat.add(c.brief.what.replace(/^\S+ \S+/, "")); // drop the victim name
  briefWhy.add(c.brief.why.replace(/^[^.]+/, "")); // drop subject/victim
  briefGoal.add(c.brief.goal);
  const sq = c.web.evidence.find((e) => e.id === "iou");
  if (sq) motives.add(sq.label);
  for (const p of c.phases) {
    const lie = p.statements.find((s) => s.lie)!;
    phaseLies.add(lie.text);
    for (const s of p.statements) if (!s.lie) phaseTruths.add(s.text);
  }
}
check(homeClaims.size >= 4, `alibi headline varies (${homeClaims.size} distinct across 200 seeds)`);
check(concessions.size >= 4, `the fold varies (${concessions.size} distinct)`);
check(phaseLies.size >= 10, `phase lies vary (${phaseLies.size} distinct openers)`);
check(phaseTruths.size >= 12, `true asides vary (${phaseTruths.size} distinct)`);
check(briefWhat.size >= 3, `the death reads differently (${briefWhat.size} framings)`);
check(briefWhy.size >= 3, `the why varies (${briefWhy.size} framings)`);
check(briefGoal.size >= 3, `the charge varies (${briefGoal.size} framings)`);
check(motives.size >= 3, `the motive's tell varies (${motives.size} distinct)`);

// A phase lie must still escalate over its three tellings (no repeats within one).
let badArc = 0;
for (let seed = 1; seed <= 120; seed++) {
  const c = generateMergedCase(seed, { supports: 2, herring: true });
  for (const p of c.phases) {
    const lie = p.statements.find((s) => s.lie)!.lie!;
    if (new Set(lie.shifts).size !== lie.shifts.length) badArc++;
  }
}
check(badArc === 0, "every phase lie has three distinct tellings (deny→hedge→admit)");

// determinism
check(JSON.stringify(generateMergedCase(42, { herring: true })) === JSON.stringify(generateMergedCase(42, { herring: true })), "content is deterministic by seed");

console.log(ok ? "\nContent OK — every register varies, arcs hold, deterministic." : "\nCONTENT BROKEN.");
process.exit(ok ? 0 : 1);
