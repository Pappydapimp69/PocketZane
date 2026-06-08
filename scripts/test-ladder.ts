/**
 * The difficulty ladder must produce sound, winnable cases at every rung — the
 * deep nights (3 supports, depth 2, keystone-prone) are where the generator's
 * verify loop is most stressed. We play each rung across many run seeds, clearing
 * phases and failing them all. Run: npx tsx scripts/test-ladder.ts
 */
import { generateMergedCase } from "../src/game/generateweb";
import { optsForNight, nightSeed, dailySeed, DAILY_OPTS } from "../src/game/ladder";
import { MergedInquiry } from "../src/game/merged";

let ok = true;
const fail = (m: string) => {
  ok = false;
  console.log("✗ " + m);
};

const winnable = (seed: number, opts: any, failPhases: boolean): boolean => {
  const c = generateMergedCase(seed, opts);
  const q = new MergedInquiry(c, seed);
  while (!q.confronting) {
    if (!failPhases) {
      const lie = q.phaseLines().find((l) => l.isLie)!;
      q.question(lie.id);
      q.pin(lie.id);
    } else {
      let guard = 0;
      while (!q.phaseOver && guard++ < 10) {
        const t = q.phaseLines().find((l) => !l.isLie && !l.pinned);
        if (t) q.pin(t.id);
        else break;
      }
    }
    q.advance();
  }
  let changed = true;
  let guard = 0;
  while (!q.solved && changed && guard++ < 80) {
    changed = false;
    for (const e of q.heldEvidence()) {
      const r = q.present(e.id);
      if (r.kind === "deflect" || r.kind === "break") changed = true;
      if (q.solved) break;
    }
  }
  return q.solved;
};

let cases = 0;
for (let night = 1; night <= 12; night++) {
  const opts = optsForNight(night);
  for (let run = 1; run <= 25; run++) {
    const seed = nightSeed(run * 1009, night);
    cases++;
    if (!winnable(seed, opts, false)) fail(`night ${night} seed ${seed}: not winnable clearing phases`);
    if (!winnable(seed, opts, true)) fail(`night ${night} seed ${seed}: not winnable FAILING phases`);
  }
}

// the daily, across a year of dates, must also be sound
for (let i = 0; i < 365; i++) {
  const d = new Date(2026, 0, 1 + i);
  const seed = dailySeed(d);
  cases++;
  if (!winnable(seed, DAILY_OPTS, false)) fail(`daily ${d.toISOString().slice(0, 10)}: not winnable`);
}

// determinism: same night+run seed → identical case
if (JSON.stringify(generateMergedCase(nightSeed(5, 6), optsForNight(6))) !== JSON.stringify(generateMergedCase(nightSeed(5, 6), optsForNight(6)))) fail("ladder non-deterministic");

console.log(`\nplayed ${cases} cases across the ladder + a year of dailies`);
console.log(ok ? "Ladder OK — every rung is sound and winnable both ways." : "LADDER BROKEN.");
process.exit(ok ? 0 : 1);
