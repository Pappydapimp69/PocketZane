/**
 * Loop-7 ratchet: cornered, the suspect invents a NEW lie. Breaking a prop that
 * was covering a key attack lets him spin a fresh claim that slides in to re-cover
 * the hole — a real new segment with its own seam, which must itself be broken.
 * It must be breakable, bounded (always terminates), and leave every case
 * solvable. Run: npx tsx scripts/test-patch.ts
 */
import { WebCase, WebInquiry } from "../src/game/web";
import { generateMergedCase } from "../src/game/generateweb";

let ok = true;
const fail = (m: string) => {
  ok = false;
  console.log("✗ " + m);
};

// ---- a hand-built minimal web pins the exact behavior (16a–d) ----
const mini: WebCase = {
  id: "mini",
  weirdness: 0,
  title: "t",
  subject: "s",
  brief: { what: "", where: "", when: "", why: "", goal: "" },
  segments: [
    { id: "k", name: "the alibi", base: "I was never there.", key: true },
    { id: "s", name: "the cover", base: "I was asleep." },
  ],
  evidence: [
    { id: "ek", label: "a witness puts him there", short: "witness", targets: "k", deflectableBy: ["s"] },
    { id: "es", label: "the light was on", short: "light", targets: "s", deflectableBy: [] },
  ],
  startEvidence: ["ek", "es"],
  deflections: { "ek:s": ["I was asleep — how would I know?"] },
  concessions: { k: "...all right. I was there.", s: "...fine, I was awake." },
  resolution: "done",
};

{
  const inq = new WebInquiry(mini, 1, undefined, undefined, true);
  // press the key — it hides behind the cover
  if (inq.present("ek").kind !== "deflect") fail("mini: key should deflect through the cover first");
  // break the cover — he should PATCH (16a: a brand-new segment appears)
  const r = inq.present("es");
  if (r.kind !== "break" || !r.patched) fail("mini: breaking the cover did not produce a patch");
  const patch = r.kind === "break" ? r.patched! : (undefined as any);
  const baseIds = new Set(mini.segments.map((s) => s.id));
  if (baseIds.has(patch.seg)) fail("mini: patch segment is not new");
  else console.log("✓ cornered, a brand-new lie appears (16a):", JSON.stringify(patch.claim));
  // 16b: the key attack no longer lands — it now deflects through the new claim
  const after = inq.present("ek");
  if (after.kind !== "deflect" || after.via !== patch.seg) fail("mini: patch did not re-cover the key attack");
  else console.log("✓ the new lie re-covers the hole (16b)");
  // 16c: the patch's seam was handed over and breaks it
  if (!inq.heldEvidence().some((e) => e.id === patch.breaker)) fail("mini: patch breaker not held/revealed");
  if (inq.present(patch.breaker).kind !== "break") fail("mini: patch segment is not breakable");
  else console.log("✓ the new lie is itself breakable (16c)");
  // now the key has nothing left — it concedes, case solved (16d terminates)
  const fin = inq.present("ek");
  if (fin.kind !== "break" || !inq.solved) fail("mini: case did not solve after the patch was broken");
  else console.log("✓ break the patch, then the key falls — it terminates (16d)");
  // 16d bounded: breaking the patch segment must NOT itself patch again
  const inq2 = new WebInquiry(mini, 1, undefined, undefined, true);
  inq2.present("ek");
  inq2.present("es");
  const pr = inq2.present(`pe_s`);
  if (pr.kind === "break" && pr.patched) fail("mini: a patch re-patched — unbounded");
  else console.log("✓ a patch does not itself re-patch — bounded (16d)");
}

// ---- generated cases with the patch live: sound, winnable, varied (16e) ----
const solveWithPatch = (web: WebCase, seed: number) => {
  const inq = new WebInquiry(web, seed, undefined, undefined, true);
  const patches: string[] = [];
  let changed = true;
  let guard = 0;
  while (!inq.solved && changed && guard++ < 300) {
    changed = false;
    for (const e of inq.heldEvidence()) {
      const r = inq.present(e.id);
      if (r.kind === "deflect" || r.kind === "break") changed = true;
      if (r.kind === "break" && r.patched) patches.push(r.patched.claim);
      if (inq.solved) break;
    }
  }
  return { solved: inq.solved, patches, steps: guard };
};

{
  let casesPatched = 0;
  let unsolved = 0;
  let ranAway = 0;
  const claims = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    for (const opts of [{ supports: 2, depth: 1, herring: true }, { supports: 3, depth: 2, weirdness: 0.9, herring: true }]) {
      const c = generateMergedCase(seed, opts);
      const { solved, patches, steps } = solveWithPatch(c.web, seed);
      if (!solved) unsolved++;
      if (steps >= 300) ranAway++;
      if (patches.length) casesPatched++;
      patches.forEach((p) => claims.add(p));
    }
  }
  if (unsolved !== 0) fail(`patch live but some cases unsolvable (${unsolved})`);
  else console.log("✓ every case still solvable with the patch live (0 unsolved)");
  if (ranAway !== 0) fail(`patching did not terminate in ${ranAway} cases`);
  else console.log("✓ patching always terminates (no runaways)");
  if (casesPatched < 40) fail(`the patch rarely fires (${casesPatched}/400)`);
  else console.log(`✓ cornered-and-patches actually happens in play (${casesPatched}/400 cases)`);
  if (claims.size < 3) fail(`patch phrasing barely varies (${claims.size} distinct)`);
  else console.log(`✓ patch phrasing is seeded and varies (${claims.size} distinct claims)`);
}

// determinism: same seed → same patch behavior
{
  const a = solveWithPatch(generateMergedCase(9, { supports: 3, depth: 2, herring: true }).web, 9);
  const b = solveWithPatch(generateMergedCase(9, { supports: 3, depth: 2, herring: true }).web, 9);
  if (JSON.stringify(a) !== JSON.stringify(b)) fail("patch play is non-deterministic");
  else console.log("✓ patch play is deterministic by seed");
}

console.log(ok ? "\nPatch OK — cornered, he invents a real new lie; breakable, bounded, solvable." : "\nPATCH BROKEN.");
process.exit(ok ? 0 : 1);
