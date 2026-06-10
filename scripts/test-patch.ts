/**
 * Loop-7 ratchet: cornered, the suspect invents a NEW lie. Breaking a prop that
 * was covering a key attack lets him spin a fresh claim that slides in to re-cover
 * the hole — a real new segment with its own seam, which must itself be broken.
 * It must be breakable, bounded (always terminates), and leave every case
 * solvable. Run: npx tsx scripts/test-patch.ts
 */
import { WebCase, WebInquiry } from "../src/game/web";
import { generateMergedCase } from "../src/game/generateweb";
import { verifyWebPatched, patchBound } from "../src/game/verify";
import { Interview } from "../src/game/interview";

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
  // 18a: NO free break — the moment the patch appears, you do not hold its seam
  if (inq.heldEvidence().some((e) => e.id === patch.breaker)) fail("mini: patch breaker handed for free (18a)");
  else console.log("✓ the patch's seam is not handed for free (18a)");
  // 18a cont.: you can't break the patch yet — you haven't pressed into it
  if (inq.present(patch.breaker).kind === "break") fail("mini: patch broke without earning its seam (18a)");
  // 16b/18b: pressing the (now patch-covered) key deflects through the new claim
  // AND reveals its seam via the ordinary recovery chain — earned, not gifted
  const after = inq.present("ek");
  if (after.kind !== "deflect" || after.via !== patch.seg) fail("mini: patch did not re-cover the key attack");
  else console.log("✓ the new lie re-covers the hole (16b)");
  if (after.kind === "deflect" && after.revealed?.id !== patch.breaker) fail("mini: pressing the patch did not reveal its seam (18b)");
  else console.log("✓ pressing into the new lie earns its seam (18b)");
  // 16c/18c: now revealed, the seam breaks the patch
  if (!inq.heldEvidence().some((e) => e.id === patch.breaker)) fail("mini: patch breaker not revealed after pressing in");
  if (inq.present(patch.breaker).kind !== "break") fail("mini: patch segment is not breakable");
  else console.log("✓ the new lie is itself breakable, once earned (16c/18c)");
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
  if (claims.size < 30) fail(`patch phrasing barely varies (${claims.size} distinct)`);
  else console.log(`✓ patch phrasing is seeded and varies (${claims.size} distinct claims)`);
  // the fresh lie should react to the prop that fell — themed, not always generic
  const themed = [...claims].some((c) => /reading|telephone|lamp|visitor|poured|errand|bath|water/i.test(c));
  if (!themed) fail("patch never themed to the broken prop (only generic scrambles)");
  else console.log("✓ the new lie reacts to the prop that just fell (themed patches fire)");
}

// the SHIPPED gate models the patch: verifyWebPatched proves the live config.
{
  // the hand web above is solvable; with the patch live it must verify solvable + terminating
  const v = verifyWebPatched(mini, mini.startEvidence);
  if (!v.solvable || !v.terminates) fail("patched verifier fails a solvable web");
  else console.log("✓ patched verifier passes a solvable web (live config proven)");

  // teeth: a web whose key hides behind a support with no breaker is unsolvable —
  // the gate that runs on every shipped case must reject it, patch live
  const trap: WebCase = {
    ...mini,
    segments: [
      { id: "k", name: "the alibi", base: "x", key: true },
      { id: "s", name: "the cover", base: "y" }, // no evidence targets s → never breakable
    ],
    evidence: [{ id: "ek", label: "", targets: "k", deflectableBy: ["s"] }],
    startEvidence: ["ek"],
    deflections: {},
    concessions: {},
  };
  const t = verifyWebPatched(trap, trap.startEvidence);
  if (t.solvable) fail("patched verifier passes an unsolvable web — gate has no teeth");
  else console.log("✓ patched verifier rejects an unsolvable web (gate has teeth)");

  // every generated (shipped) case clears the patched gate
  let gateFails = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const web = generateMergedCase(seed, { supports: 3, depth: 2, weirdness: 0.8, herring: true }).web;
    const r = verifyWebPatched(web, web.startEvidence);
    if (!r.solvable || !r.terminates) gateFails++;
  }
  if (gateFails !== 0) fail(`shipped cases fail the patched gate (${gateFails}/150)`);
  else console.log("✓ every shipped case clears the patch-live gate (150/150)");

  // termination is structural, not luck: patches never exceed one per non-key prop
  let unbounded = 0;
  let maxSeen = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const web = generateMergedCase(seed, { supports: 3, depth: 2, weirdness: 0.8, herring: true }).web;
    const r = verifyWebPatched(web, web.startEvidence);
    if (!r.bounded || r.patches > patchBound(web)) unbounded++;
    maxSeen = Math.max(maxSeen, r.patches);
  }
  if (unbounded !== 0) fail(`patch count exceeded its structural bound (${unbounded}/150)`);
  else console.log(`✓ patches structurally bounded — at most one per prop (max seen ${maxSeen})`);
}

// VERIFIED AS PLAYED: not just the minimum hand — every confrontation the
// interview can actually hand off (caught props pre-broken, levers gathered) must
// also be solvable + terminating with the patch live. This closes the gap between
// "verified from nothing" and "verified from the hands real play produces."
{
  let handoffs = 0;
  let bad = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const c = generateMergedCase(seed, { supports: 2, depth: 1, herring: true });
    // a few representative ways to play the interview
    const plays: ((iv: Interview) => void)[] = [
      () => {}, // skipped entirely
      (iv) => { for (const q of c.questions!.filter((q) => q.kind === "lever")) iv.ask(q.id); for (const q of c.questions!.filter((q) => q.kind === "lie")) if (iv.canPress(q.id)) iv.press(q.id); },
      (iv) => { for (const q of c.questions!) { if (iv.done) break; iv.ask(q.id); } for (const q of c.questions!.filter((q) => q.kind === "lie")) if (iv.canPress(q.id)) iv.press(q.id); },
    ];
    for (const play of plays) {
      const iv = new Interview(c.questions!, c.rounds);
      // play levers first so contradictions/levers can be spent, then run the line
      for (const q of c.questions!.filter((q) => q.kind === "tell")) { if (!iv.done) iv.ask(q.id); }
      play(iv);
      const inq = iv.toWeb(c.web, seed, true);
      // re-derive the handoff state and verify it under patch
      const held = inq.heldEvidence().map((e) => e.id);
      const broken = inq.segments().filter((s) => s.broken).map((s) => s.id);
      const r = verifyWebPatched(c.web, held, broken);
      handoffs++;
      if (!r.solvable || !r.terminates) bad++;
    }
  }
  if (bad !== 0) fail(`some real interview handoffs aren't solvable under patch (${bad}/${handoffs})`);
  else console.log(`✓ every interview handoff is solvable under patch as played (${handoffs} handoffs)`);
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
