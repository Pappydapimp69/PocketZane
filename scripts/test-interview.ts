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
      if (q.kind === "lie") {
        if (!segIds.has(q.seg!)) fail(`seed ${seed}/${q.id}: lie targets no segment`);
        if (q.leverId && !evIds.has(q.leverId)) fail(`seed ${seed}/${q.id}: lie names a bad lever`); // leverId optional (contradiction-only lies)
      }
      if (q.kind === "lever" && !evIds.has(q.evId!)) fail(`seed ${seed}/${q.id}: bad lever`);
      if (q.kind === "tell" && !segIds.has(q.seg!)) fail(`seed ${seed}/${q.id}: tell targets no segment`);
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

// a lie cannot be pressed without its lever (find a seed whose interview has one)
{
  let tested = false;
  for (let seed = 1; seed <= 50 && !tested; seed++) {
    const c = generateMergedCase(seed, { supports: 2, herring: true });
    const lever = c.questions!.find((q) => q.kind === "lever");
    if (!lever) continue;
    const lie = c.questions!.find((q) => q.kind === "lie" && q.leverId === lever.evId);
    if (!lie) continue;
    const a = new Interview(c.questions!, c.rounds);
    a.ask(lie.id); // asked, but no lever held and no contradiction surfaced
    if (a.canPress(lie.id)) fail("pressed a lie with no lever and no contradiction");
    if (a.press(lie.id).kind !== "blocked") fail("press not blocked without leverage");
    tested = true;
  }
  if (!tested) fail("no lever-bearing case found to test lever-gating");
}

// CRITERION 14: the interview composition varies across cases.
{
  const compositions = new Set<string>();
  const tellCounts = new Set<number>();
  let twoContradictions = 0;
  let leverShape = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const qs = generateMergedCase(seed, { supports: 2, depth: 1, weirdness: 0.1, herring: true }).questions!;
    const kinds = qs.map((q) => q.kind).sort();
    compositions.add(kinds.join(","));
    const tells = qs.filter((q) => q.kind === "tell").length;
    tellCounts.add(tells);
    if (tells >= 2) twoContradictions++;
    if (qs.some((q) => q.kind === "lever")) leverShape++;
  }
  if (compositions.size < 2) fail(`interview shape is a fixed template (${compositions.size} compositions)`);
  else console.log(`✓ interview composition varies (${compositions.size} distinct shapes across 200 seeds)`);
  if (tellCounts.size < 2) fail(`tell count is constant (${[...tellCounts].join("/")})`);
  else console.log(`✓ tell count varies (${[...tellCounts].sort().join("/")} per case)`);
  if (twoContradictions < 20 || leverShape < 20) fail(`one shape is rare (2-contradiction ${twoContradictions}, lever ${leverShape})`);
  else console.log(`✓ both shapes common — second contradiction ${twoContradictions}/200, lever ${leverShape}/200`);
}

// CRITERION 11: a contradiction from his OWN answers, before external evidence.
{
  let withContradiction = 0;
  let crackedByOwnWords = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const c = generateMergedCase(seed, { supports: 2, depth: 1, weirdness: 0.2, herring: true });
    const qs = c.questions!;
    // 11a: a lie and a tell that targets the same prop both exist (own answers conflict)
    const tell = qs.find((q) => q.kind === "tell");
    const lie = tell && qs.find((q) => q.kind === "lie" && q.seg === tell.seg);
    if (!tell || !lie) continue;
    withContradiction++;
    if (!tell.clash) fail(`seed ${seed}: contradiction has no player-facing clash text`);

    const a = new Interview(qs, c.rounds);
    // 11e: before hearing the tell, the lie is NOT crackable from the lie alone
    a.ask(lie.id);
    if (a.canPress(lie.id)) fail(`seed ${seed}: lie crackable before the tell (would be rote)`);
    // 11a/d: hearing his other answer surfaces a usable contradiction — no external evidence
    a.ask(tell.id);
    if (a.contradictions().length < 1) fail(`seed ${seed}: contradiction not stored`); // 11c stored
    if (a.pressVia(lie.id) !== "contradiction") fail(`seed ${seed}: not crackable via his own words`);
    if (!a.canPress(lie.id)) fail(`seed ${seed}: contradiction not usable as leverage`); // 11d
    if (a.heldLevers().length !== 0) fail(`seed ${seed}: contradiction leaked an external lever`); // 11e
    const r = a.press(lie.id);
    if (r.kind !== "caught") fail(`seed ${seed}: own-words press did not catch`);
    crackedByOwnWords++;
  }
  if (withContradiction < 190) fail(`too few self-contradictions (${withContradiction}/200)`);
  else console.log(`✓ every case carries a self-contradiction (${withContradiction}/200)`);
  if (crackedByOwnWords !== withContradiction) fail(`some contradictions not crackable by own words (${crackedByOwnWords}/${withContradiction})`);
  else console.log(`✓ each crackable by his own words, no lever (${crackedByOwnWords}/${withContradiction})`);
}

// CRITERION 13: the keystone reaches Act 1 (suspicion only — no Act-1 break).
{
  let keystoneCases = 0;
  let suspicionWorks = 0;
  let falsePos = 0;
  for (let seed = 1; seed <= 250; seed++) {
    const c = generateMergedCase(seed, { weirdness: 0.95, herring: true });
    const ks = c.web.segments.find((s) => s.keystone);
    if (ks) {
      keystoneCases++;
      const kq = c.questions!.find((q) => q.kind === "keystone");
      if (!kq) {
        fail(`seed ${seed}: keystone case has no keystone question`);
        continue;
      }
      const a = new Interview(c.questions!, c.rounds);
      if (a.canPress(kq.id)) fail(`seed ${seed}: keystone question is breakable in Act 1`); // 13a
      a.ask(kq.id);
      if (a.suspectedKeystone() !== ks.id) fail(`seed ${seed}: suspicion not stored`); // 13b
      if (a.caughtSegments().includes(ks.id)) fail(`seed ${seed}: keystone pre-broken by Act 1`); // 13d
      const inq = a.toWeb(c.web, seed);
      if (inq.segments().find((s) => s.id === ks.id)?.broken) fail(`seed ${seed}: keystone arrives already broken`); // 13d
      suspicionWorks++;
    } else {
      const a = new Interview(c.questions!, c.rounds);
      c.questions!.forEach((q) => a.ask(q.id));
      if (a.suspectedKeystone()) falsePos++; // 13e
    }
  }
  if (keystoneCases < 40) fail(`too few keystone cases sampled (${keystoneCases})`);
  else console.log(`✓ keystone cases sampled (${keystoneCases})`);
  if (suspicionWorks !== keystoneCases) fail(`keystone Act-1 wiring off (${suspicionWorks}/${keystoneCases})`);
  else console.log(`✓ keystone surfaced, askable, suspicion stored, not pre-broken (${suspicionWorks}/${keystoneCases})`);
  if (falsePos !== 0) fail(`false keystone suspicion in non-keystone cases (${falsePos})`);
  else console.log(`✓ no false keystone suspicion in non-keystone cases`);
}

console.log(`\nplayed ${n} interviews`);
console.log(ok ? "Interview OK — five/three, lever-gated, winnable played or skipped." : "INTERVIEW BROKEN.");
process.exit(ok ? 0 : 1);
