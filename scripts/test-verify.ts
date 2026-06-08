/**
 * The solvability verifier: it passes the real case from the worst-case hand,
 * and it CATCHES an unsolvable web (a key lie whose only support can never be
 * broken). Run: npx tsx scripts/test-verify.ts
 */
import { verifyWeb } from "../src/game/verify";
import { WebCase } from "../src/game/web";
import { WELLS } from "../src/game/mergedcase";

let ok = true;
const check = (p: boolean, m: string) => {
  if (!p) ok = false;
  console.log(`${p ? "✓" : "✗"} ${m}`);
};

// Real case: solvable from just the start leads (i.e. having failed every phase).
{
  const r = verifyWeb(WELLS.web, WELLS.startLeads);
  check(r.solvable, "Wells Street is winnable from the worst-case hand (only the coat)");
  check(r.order.includes("sleep") && r.order.indexOf("sleep") < r.order.indexOf("home"), "the support falls before the alibi");
}

// Unsolvable web: the alibi can only deflect, and its support has no breaker.
{
  const stuck: WebCase = {
    id: "stuck",
    weirdness: 0,
    title: "",
    subject: "",
    brief: { what: "", where: "", when: "", why: "", goal: "" },
    segments: [
      { id: "home", name: "the alibi", key: true, base: "" },
      { id: "sleep", name: "the sleep story", base: "" },
    ],
    evidence: [
      // coat attacks home but is deflected by sleep; nothing can break sleep.
      { id: "coat", label: "", targets: "home", deflectableBy: ["sleep"] },
    ],
    startEvidence: [],
    deflections: {},
    concessions: {},
    resolution: "",
  };
  check(!verifyWeb(stuck, ["coat"]).solvable, "an unbreakable support is flagged unsolvable");
}

// And the same web becomes solvable once the support has a breaker.
{
  const fixed: WebCase = {
    id: "fixed",
    weirdness: 0,
    title: "",
    subject: "",
    brief: { what: "", where: "", when: "", why: "", goal: "" },
    segments: [
      { id: "home", name: "the alibi", key: true, base: "" },
      { id: "sleep", name: "the sleep story", base: "" },
    ],
    evidence: [
      { id: "coat", label: "", targets: "home", deflectableBy: ["sleep"] },
      { id: "call", label: "", targets: "sleep", deflectableBy: [] },
    ],
    startEvidence: [],
    deflections: {},
    concessions: {},
    resolution: "",
  };
  // even starting with only the coat, the deflect reveals the call -> solvable.
  check(verifyWeb(fixed, ["coat"]).solvable, "adding a breaker (recoverable via deflection) makes it solvable");
}

console.log(ok ? "\nVerifier OK." : "\nVERIFIER BROKEN.");
process.exit(ok ? 0 : 1);
