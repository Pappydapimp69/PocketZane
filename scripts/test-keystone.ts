/**
 * The keystone bluff: many lies lean on one fabricated support; find its tell,
 * and the whole structure cascades. Run: npx tsx scripts/test-keystone.ts
 */
import { generateWeb } from "../src/game/generateweb";
import { verifyWeb } from "../src/game/verify";
import { WebInquiry } from "../src/game/web";

let ok = true;
const check = (p: boolean, m: string) => {
  if (!p) ok = false;
  console.log(`${p ? "✓" : "✗"} ${m}`);
};

const web = generateWeb(11, { keystone: true });
check(web.segments.some((s) => s.keystone), "a keystone segment exists");
check(verifyWeb(web, web.startEvidence).solvable, "the keystone case is winnable");

const w = new WebInquiry(web, 11);
const keystone = web.segments.find((s) => s.keystone)!;
const tell = web.evidence.find((e) => e.targets === keystone.id)!;
const startAttacks = web.startEvidence;

// press the two held attacks — both deflect through the keystone
const d1 = w.present(startAttacks[0]);
check(d1.kind === "deflect" && d1.via === keystone.id, "the first lie deflects through the keystone");
const d2 = w.present(startAttacks[1]);
check(d2.kind === "deflect" && d2.via === keystone.id, "the second lie also leans on the keystone");
check(!w.solved, "nothing has fallen yet");

// the tell breaks the keystone -> cascade collapses both dependents at once
const r = w.present(tell.id);
check(r.kind === "break" && (r as { keystone?: boolean }).keystone === true, "the tell breaks the keystone");
const cascaded = (r as { cascaded?: string[] }).cascaded ?? [];
check(cascaded.length >= 2, `breaking it cascades ${cascaded.length} more lies`);
check((r as { solved: boolean }).solved, "the case solves in one move — the whole thing comes down");

console.log(ok ? "\nKeystone cascade OK." : "\nKEYSTONE BROKEN.");
process.exit(ok ? 0 : 1);
