/**
 * Verifies the deduction case is solvable and that the engine forces revisions
 * in the right order. Run: npx tsx scripts/test-deduction.ts
 */
import { Inquiry } from "../src/game/deduction";
import { WELLS_STREET } from "../src/game/cases2";

let ok = true;
const check = (pass: boolean, msg: string) => {
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg}`);
};

const q = new Inquiry(WELLS_STREET);

// Out-of-order / irrelevant present is rejected.
check(q.present("home", "coroner").kind === "nomatch", "coroner doesn't touch the first defense");
check(q.present("time", "coat").kind === "nomatch", "coat doesn't touch the hour");

// home: coat forces the porch; question yields neighbor; neighbor forces 'went up'; coroner breaks.
check(q.present("home", "coat").kind === "forced", "coat forces home → porch");
check((q.question("home")?.gained ?? []).some((e) => e.id === "neighbor"), "questioning home yields the neighbor");
check(q.present("home", "neighbor").kind === "forced", "neighbor forces home → went up");
{
  const r = q.present("home", "coroner");
  check(r.kind === "broke", "coroner breaks the alibi");
}

// time: needs the call (from questioning), then the neighbor (already held) breaks it.
check((q.question("time")?.gained ?? []).some((e) => e.id === "call"), "questioning time yields the call");
check(q.present("time", "call").kind === "forced", "call forces time → took a call");
{
  const r = q.present("time", "neighbor");
  check(r.kind === "broke", "neighbor breaks the hour");
}

check(q.solved, "case solved once both key threads break");

// money is optional motive.
q.question("money");
check(q.present("money", "iou").kind === "broke", "iou breaks the money thread (motive)");

console.log(ok ? "\nDeduction case solvable." : "\nDEDUCTION CASE BROKEN.");
process.exit(ok ? 0 : 1);
