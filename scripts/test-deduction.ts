/**
 * Verifies the phase + confrontation engine. Run: npx tsx scripts/test-deduction.ts
 *   - phases: pressing a lie shifts it; pinning it yields a lead; pinning a truth
 *     strikes, and three strikes fails the phase.
 *   - confrontation is solvable EVEN IF you failed every phase (only the coat in
 *     hand), via partial presses that recover the missing leads.
 *   - and solvable directly when you gathered the leads.
 */
import { Inquiry, PHASE_STRIKES } from "../src/game/deduction";
import { WELLS_STREET } from "../src/game/cases2";

let ok = true;
const check = (pass: boolean, msg: string) => {
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg}`);
};

// --- phase mechanics ---
{
  const q = new Inquiry(WELLS_STREET);
  check(q.pin("stairs").kind === "not-caught", "can't pin a lie you haven't pressed");
  check(q.question("stairs").shifted, "pressing the lie shifts it");
  const r = q.pin("stairs");
  check(r.kind === "lead" && r.lead.id === "neighbor", "pinning the shifted lie yields its lead");

  const q2 = new Inquiry(WELLS_STREET);
  q2.pin("rain"); // truth -> strike
  q2.pin("keep"); // truth -> strike
  const r3 = q2.pin("rain") as { kind: string; failed?: boolean };
  check(r3.kind === "strike" && r3.failed === true, `three strikes fails the phase (${PHASE_STRIKES})`);
}

// --- confrontation solvable having FAILED every phase (only the coat) ---
{
  const q = new Inquiry(WELLS_STREET);
  q.advance(); // skip phase 1 (gather nothing)
  q.advance(); // skip phase 2
  q.advance(); // -> confrontation
  check(q.confronting, "advancing past the last phase enters the confrontation");
  check(q.heldLeads().length === 1 && q.heldLeads()[0].id === "coat", "only the coat in hand after failing all phases");

  // outside: coat partial reveals neighbor; neighbor breaks it.
  const p1 = q.present("home", "coat");
  check(p1.kind === "partial" && p1.revealed?.id === "neighbor", "coat dents the alibi and reveals the neighbor");
  check(q.present("home", "neighbor").kind === "break", "neighbor breaks the alibi");

  // hour: neighbor partial reveals call; call breaks it.
  const p2 = q.present("asleep", "neighbor");
  check(p2.kind === "partial" && p2.revealed?.id === "call", "the neighbor dents the hour and reveals the call");
  const p3 = q.present("asleep", "call");
  check(p3.kind === "break" && p3.solved, "the call breaks the hour and solves the case");
}

// --- confrontation solvable directly when leads were gathered ---
{
  const q = new Inquiry(WELLS_STREET);
  // gather all three phase leads
  for (const id of ["stairs", "phone", "owed"]) {
    q.question(id);
    q.pin(id);
    q.advance();
  }
  check(q.confronting && q.heldLeads().length === 4, "gathered all leads across the phases");
  check(q.present("home", "coat").kind === "partial", "coat dents the alibi");
  check(q.present("home", "neighbor").kind === "break", "neighbor breaks the alibi");
  check(q.present("asleep", "call").kind === "partial", "call dents the hour");
  check(q.present("asleep", "neighbor").kind === "break", "neighbor finishes the hour");
  check(q.present("square", "iou").kind === "break", "iou breaks the motive");
  check(q.solved, "case solved");
}

console.log(ok ? "\nPhase + confrontation engine OK." : "\nENGINE BROKEN.");
process.exit(ok ? 0 : 1);
