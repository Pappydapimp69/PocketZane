/**
 * Verifies the merged loop: phases gather web leads, the confrontation is the
 * web, and it's solvable whether you cleared the phases or failed every one.
 * Run: npx tsx scripts/test-merged.ts
 */
import { MergedInquiry } from "../src/game/merged";
import { WELLS } from "../src/game/mergedcase";

let ok = true;
const check = (p: boolean, m: string) => {
  if (!p) ok = false;
  console.log(`${p ? "✓" : "✗"} ${m}`);
};

// Clear all three phases, then confront.
{
  const q = new MergedInquiry(WELLS, 3);
  for (const id of ["stairs", "phone", "owed"]) {
    q.question(id);
    const r = q.pin(id);
    check(r.kind === "lead", `phase ${q.phaseIdx + 1}: pinning the shifted lie yields a lead`);
    q.advance();
  }
  check(q.confronting, "after three phases, the confrontation begins");
  check(q.heldEvidence().length === 4, "carrying all four leads in");
  check(q.present("coat").kind === "deflect", "the coat deflects through the sleep story");
  check(q.present("call").kind === "break", "the call breaks the sleep story");
  const r = q.present("coat");
  check(r.kind === "break" && r.solved, "now the coat breaks the alibi and solves it");
}

// Fail every phase (three strikes each), then recover in the confrontation.
{
  const q = new MergedInquiry(WELLS, 3);
  for (let p = 0; p < 3; p++) {
    // pin the two truths twice over to strike out
    const truths = q.phaseLines().filter((l) => !l.isLie).map((l) => l.id);
    q.pin(truths[0]);
    q.pin(truths[1]);
    const r = q.pin(truths[0]);
    check(r.kind === "strike" && (r as { failed: boolean }).failed, `phase ${p + 1} fails on three strikes`);
    q.advance();
  }
  check(q.confronting && q.heldEvidence().length === 1, "into the confrontation with only the coat");
  const d = q.present("coat");
  check(d.kind === "deflect" && (d as { revealed?: { id: string } }).revealed?.id === "call", "leaning on the sleep story hands you the call");
  check(q.present("call").kind === "break", "the call breaks the sleep story");
  const r = q.present("coat");
  check(r.kind === "break" && r.solved, "the coat breaks the alibi — solved despite failing every phase");
}

console.log(ok ? "\nMerged loop OK." : "\nMERGED BROKEN.");
process.exit(ok ? 0 : 1);
