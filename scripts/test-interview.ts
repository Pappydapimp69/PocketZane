/**
 * The interview (Act 1 redesign): five questions, three rounds, lever-gated
 * catches that pre-break props and carry into the confrontation. Across seeds
 * and the difficulty range it must be sound and winnable both ways — playing the
 * interview well (catch what you can) AND skipping it entirely (the gaps surface
 * in the confrontation). Run: npx tsx scripts/test-interview.ts
 */
import { generateMergedCase } from "../src/game/generateweb";
import { Interview } from "../src/game/interview";

let ok = true;
const fail = (m: string) => {
  ok = false;
  console.log("✗ " + m);
};

const winnable = (web: any, q: Interview, seed: number): boolean => {
  const inq = q.toWeb(web, seed);
  let changed = true;
  let guard = 0;
  while (!inq.solved && changed && guard++ < 80) {
    changed = false;
    for (const e of inq.heldEvidence()) {
      const r = inq.present(e.id);
      if (r.kind === "deflect" || r.kind === "break") changed = true;
      if (inq.solved) break;
    }
  }
  return inq.solved;
};

let n = 0;
for (let seed = 1; seed <= 200; seed++) {
  for (const opts of [{ supports: 1, weirdness: 0 }, { supports: 2, depth: 1, weirdness: 0.2, herring: true }, { supports: 3, depth: 2, weirdness: 0.9, herring: true }]) {
    const c = generateMergedCase(seed, opts);
    n++;

    // structure: exactly five questions, three rounds, every lie's lever is a real
    // web evidence id and every prop a real segment.
    if (!c.questions || c.questions.length !== 5) fail(`seed ${seed}: ${c.questions?.length} questions`);
    if (c.rounds !== 3) fail(`seed ${seed}: ${c.rounds} rounds`);
    const evIds = new Set(c.web.evidence.map((e) => e.id));
    const segIds = new Set(c.web.segments.map((s) => s.id));
    for (const q of c.questions ?? []) {
      if (q.kind === "lie" && (!segIds.has(q.seg!) || !evIds.has(q.leverId!))) fail(`seed ${seed}/${q.id}: bad lie wiring`);
      if (q.kind === "lever" && !evIds.has(q.evId!)) fail(`seed ${seed}/${q.id}: bad lever`);
      // never interview the keystone — it's the confrontation's payoff
      if (q.kind === "lie" && c.web.segments.find((s) => s.id === q.seg)?.keystone) fail(`seed ${seed}/${q.id}: keystone leaked into interview`);
    }

    // play it well: ask levers first, then their lies, press what we can
    const a = new Interview(c.questions!, c.rounds);
    const levers = c.questions!.filter((q) => q.kind === "lever");
    const lies = c.questions!.filter((q) => q.kind === "lie");
    for (const q of [...levers, ...lies]) {
      if (a.done) break;
      a.ask(q.id);
    }
    for (const q of lies) if (a.canPress(q.id)) a.press(q.id);
    if (!winnable(c.web, a, seed)) fail(`seed ${seed}: not winnable after a good interview`);
    // at least when a lever+lie pair was askable in 3 rounds, something gets caught
    // (not asserted as a hard rule — duds can crowd — but track coverage)

    // skip it entirely: ask three duds (or whatever), catch nothing
    const b = new Interview(c.questions!, c.rounds);
    const duds = c.questions!.filter((q) => q.kind === "dud");
    for (const q of [...duds, ...c.questions!]) {
      if (b.done) break;
      b.ask(q.id);
    }
    if (b.caughtSegments().length !== 0) fail(`seed ${seed}: caught a prop without a lever`);
    if (!winnable(c.web, b, seed)) fail(`seed ${seed}: not winnable after skipping the interview`);
  }
}

// determinism
if (JSON.stringify(generateMergedCase(7).questions) !== JSON.stringify(generateMergedCase(7).questions)) fail("questions non-deterministic");

// a lie cannot be pressed without its lever
{
  const c = generateMergedCase(3, { supports: 2, herring: true });
  const a = new Interview(c.questions!, c.rounds);
  const lie = c.questions!.find((q) => q.kind === "lie")!;
  a.ask(lie.id); // asked, but no lever held
  if (a.canPress(lie.id)) fail("pressed a lie with no lever");
  if (a.press(lie.id).kind !== "blocked") fail("press not blocked without lever");
}

console.log(`\nplayed ${n} interviews`);
console.log(ok ? "Interview OK — five/three, lever-gated, winnable played or skipped." : "INTERVIEW BROKEN.");
process.exit(ok ? 0 : 1);
