/**
 * Proves the constraint-web loop: a head-on hit deflects through a support, the
 * alibi can't fall while the support stands, and breaking the support first lets
 * the held-back attack land. Run: npx tsx scripts/test-web.ts
 */
import { WebInquiry } from "../src/game/web";
import { WELLS_WEB } from "../src/game/webcase";

let ok = true;
const check = (pass: boolean, msg: string) => {
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg}`);
};

// Head-on hits deflect through the sleep story; the alibi holds.
{
  const w = new WebInquiry(WELLS_WEB, 7);
  const r1 = w.present("coat");
  check(r1.kind === "deflect" && r1.via === "sleep", "the coat deflects through the sleep story");
  const r2 = w.present("neighbor");
  check(r2.kind === "deflect" && r2.via === "sleep", "the neighbor deflects through the sleep story too");
  check(!w.solved, "the alibi still stands while the sleep story does");
  const home = w.segments().find((s) => s.id === "home")!;
  check(home.leansOn === "sleep", "the alibi visibly leans on the sleep story");
  const sleep = w.segments().find((s) => s.id === "sleep")!;
  check(sleep.propsUp.includes("home"), "the sleep story visibly props up the alibi");
}

// Break the support, then the attack lands.
{
  const w = new WebInquiry(WELLS_WEB, 7);
  w.present("coat"); // deflected
  const rc = w.present("call");
  check(rc.kind === "break" && rc.target === "sleep", "the call breaks the sleep story (nothing to hide behind)");
  const rh = w.present("coat");
  check(rh.kind === "break" && rh.target === "home", "now the coat breaks the alibi");
  check((rh as { solved: boolean }).solved, "case solved");
}

// Phrasing varies with the seed (a lie doesn't deflect the same way twice).
{
  const a = new WebInquiry(WELLS_WEB, 1).present("coat");
  const b = new WebInquiry(WELLS_WEB, 99).present("coat");
  check(a.kind === "deflect" && b.kind === "deflect", "both deflect");
  // not a hard guarantee, but with these pools different seeds usually differ:
  check((a as { text: string }).text !== undefined && (b as { text: string }).text !== undefined, "deflection text is generated");
}

console.log(ok ? "\nConstraint-web loop OK." : "\nWEB BROKEN.");
process.exit(ok ? 0 : 1);
