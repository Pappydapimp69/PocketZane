import { WebCase, WebSegment, WebEvidence } from "./web";
import { MergedCase, Phase, PhaseStatement } from "./merged";
import { verifyWeb } from "./verify";
import { deflectionPool, claimLine, concessionLine, coreClaim, coreConcession, motivePick, shiftTriple, phaseTruths, premise, whyLine, goalLine } from "./phrasing";
import { mulberry32 } from "./rng";

/**
 * Generative MOVES (step 7). Instead of authoring `deflectableBy` by hand, the
 * engine composes the web from a small ontology: a core lie, a set of ATTACKS
 * that hit it, and SUPPORTS (alt-causes) the lie can deflect through — each
 * support being its own lie with a seam (the evidence that breaks it), optionally
 * propped by a deeper support. Difficulty = how many supports / how deep. Every
 * candidate is run through the solvability verifier; by construction it passes,
 * but we guard and reseed if it ever doesn't.
 *
 * Deterministic by seed. Templated text for now (the phrasing grammar is step 5).
 */

interface SupportT {
  id: string;
  name: string;
  seam: { id: string; short: string; label: string };
}

const SUPPORTS: SupportT[] = [
  { id: "sleep", name: "the sleep story", seam: { id: "call", short: "the call", label: "Phone records: a call from the building at 10:50." } },
  { id: "porch", name: "the porch", seam: { id: "mud", short: "the mud", label: "Mud from the upper landing, dried on his boots." } },
  { id: "dark", name: "the dark stairwell", seam: { id: "log", short: "the light log", label: "Maintenance log: the stair light was working that week." } },
  { id: "visitor", name: "the visitor", seam: { id: "alone", short: "the empty book", label: "The desk's sign-in book: no visitor for him all night." } },
  { id: "drink", name: "the drink", seam: { id: "sober", short: "the barman", label: "The barman: he left sober, and early." } },
  { id: "errand", name: "the errand", seam: { id: "shop", short: "the shopkeeper", label: "The corner shop closed at nine — no one served him that night." } },
  { id: "bath", name: "the bath", seam: { id: "water", short: "the water meter", label: "The water meter shows no draw all evening." } },
];

interface AttackT {
  id: string;
  short: string;
  label: string;
}
const ATTACKS: AttackT[] = [
  { id: "coat", short: "the coat", label: "His coat was logged soaked through at intake." },
  { id: "neighbor", short: "the neighbor", label: "A neighbor saw someone on the stairs near 10:30." },
  { id: "prints", short: "the prints", label: "His prints on the upstairs latch." },
  { id: "shout", short: "the argument", label: "Two tenants heard them shouting at nine." },
  { id: "key", short: "the key", label: "A key with his tag, found in the upstairs lock." },
  { id: "cab", short: "the cab", label: "A cabman set a fare down at the door near eleven." },
  { id: "glove", short: "the glove", label: "A glove of his, dropped on the upstairs landing." },
  { id: "watch", short: "the stopped watch", label: "The victim's watch stopped at 10:40, smashed in the fall." },
];

const HERRINGS = [
  { id: "cig", short: "a cigarette", label: "A cigarette stubbed out by the street door." },
  { id: "smudge", short: "a smudge", label: "A smudge on the bannister, too faint to read." },
];

// Keystones: bluffs with no floor of their own. Many lies lean on one, and when
// its tell is found, the whole structure cascades.
const KEYSTONES: SupportT[] = [
  { id: "partner", name: "the partner", seam: { id: "sister", short: "her sister", label: "Her sister puts her across town the whole night." } },
  { id: "brother", name: "the brother's word", seam: { id: "ticket", short: "the ticket stub", label: "A train stub: his brother was three towns over that night." } },
  { id: "lodger", name: "the lodger's word", seam: { id: "rent", short: "the rent book", label: "The rent book: that room sat empty all month — no lodger at all." } },
];

const VICTIMS = ["Edmund Carr", "Walter Brill", "Sam Okafor", "Henry Vance", "Leon Pryce", "Arthur Mosely", "Desmond Hale", "Conrad Webb", "Marcus Lyle", "Tobias Renn", "Gideon Frost", "Niall Ackroyd", "Oscar Reed", "Julius Mott", "Albert Crane", "Stefan Voss", "Roland Pyke", "Ezra Linden"];
const PLACES = ["Wells Street", "Harrow Lane", "Sutter Row", "the Macklin building", "Dover Court", "Calder Mews", "Pennick Yard", "Ashby Walk", "the Greel building", "Marlow Rise", "Tanner's Close", "Verrick Court", "Halloway Steps", "Cobden Wharf", "Ardwick Terrace"];
const SUBJECTS = ["the downstairs tenant", "the brother-in-law", "the landlord", "the old friend", "the night porter", "the upstairs lodger", "the rent collector", "the former partner", "the man across the hall", "the building's caretaker", "the debt collector", "the estranged son", "the business partner", "the jealous neighbor"];

// Question-phase framing, keyed by the seam evidence a phase yields. The lie's
// shifting tellings and the true asides come from the phrasing grammar; this
// just sets each phase's heading and the line that points the player at it.
interface PhaseT {
  title: string;
  prompt: string;
}
const PHASES_BY_SEAM: Record<string, PhaseT> = {
  call: { title: "The Hour", prompt: "When he turned in. Find the line that drifts." },
  mud: { title: "The Threshold", prompt: "How far he went. Catch the part he keeps shrinking." },
  log: { title: "What Could Be Seen", prompt: "What the dark hid. Press the certainty." },
  alone: { title: "The Company", prompt: "Who was with him. Find the friend who wasn't." },
  sober: { title: "The Drink", prompt: "How clear his head was. Catch the dodge." },
  shop: { title: "The Errand", prompt: "Where he went, and whether the shop was open at all. Catch the drift." },
  water: { title: "The Bath", prompt: "What he heard from the tub. Press what the water would have drowned." },
  sister: { title: "The Corroboration", prompt: "The one who'll vouch for him. Find the crack." },
  ticket: { title: "The Witness", prompt: "His witness. Press until it bends." },
  rent: { title: "The Lodger", prompt: "The man who rooms with him. Find the room that's empty." },
  iou: { title: "The Bad Blood", prompt: "What stood between them. Catch the thing he smooths over." },
};
const ROMAN = ["I", "II", "III", "IV"];

function shuffle<T>(a: T[], rng: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
const pick = <T>(a: T[], rng: () => number): T => a[Math.floor(rng() * a.length)];

// "the Macklin building" -> "The Macklin building Stairs" (no doubled "the");
// places already ending in a stair-word ("Halloway Steps") don't take the suffix.
const caseTitle = (place: string): string => {
  const p = place.replace(/^the\s+/i, "");
  return /(steps|stairs|wharf)$/i.test(p) ? `The ${p}` : `The ${p} Stairs`;
};
const locWhere = (place: string): string => (/building/i.test(place) ? `At ${place}.` : `His building on ${place}.`);

export interface GenOpts {
  supports?: number; // how many supports prop the alibi (default 2)
  depth?: number; // 1 = flat supports, 2 = one support propped by a deeper one
  weirdness?: number; // also the probability a case is built around a keystone bluff
  herring?: boolean;
  keystone?: boolean; // force a keystone case
}

function buildKeystone(seed: number, rng: () => number, opts: GenOpts): { web: WebCase; leadable: string[] } {
  const K = pick(KEYSTONES, rng);
  const dep = pick(SUPPORTS, rng);
  const homeAttacks = shuffle(ATTACKS, rng).slice(0, 2);
  const victim = pick(VICTIMS, rng);
  const place = pick(PLACES, rng);
  const subject = pick(SUBJECTS, rng);
  const victimShort = victim.split(" ").slice(-1)[0];

  const mot = motivePick(rng);
  const segments: WebSegment[] = [
    { id: "home", name: "the alibi", key: true, base: coreClaim(rng) },
    { id: dep.id, name: dep.name, base: claimLine(dep.id, rng) },
    { id: K.id, name: K.name, keystone: true, base: claimLine(K.id, rng) },
    { id: "square", name: "the motive", base: mot.claim },
  ];
  const evidence: WebEvidence[] = [];
  const deflections: Record<string, string[]> = {};
  const concessions: Record<string, string> = {
    home: coreConcession(rng),
    [dep.id]: concessionLine(dep.id, rng),
    [K.id]: concessionLine(K.id, rng),
    square: mot.concession,
  };
  for (const a of homeAttacks) {
    evidence.push({ id: a.id, short: a.short, label: a.label, targets: "home", deflectableBy: [K.id] });
    deflections[`${a.id}:${K.id}`] = deflectionPool(3, K.id, a.short, rng);
  }
  evidence.push({ id: dep.seam.id, short: dep.seam.short, label: dep.seam.label, targets: dep.id, deflectableBy: [K.id] });
  deflections[`${dep.seam.id}:${K.id}`] = deflectionPool(3, K.id, dep.seam.short, rng);
  evidence.push({ id: K.seam.id, short: K.seam.short, label: K.seam.label, targets: K.id, deflectableBy: [] });
  evidence.push({ id: "iou", short: mot.evShort, label: mot.evLabel, targets: "square", deflectableBy: [] });

  const web: WebCase = {
    id: `gen-k-${seed}`,
    weirdness: opts.weirdness ?? 0.6,
    title: caseTitle(place),
    subject,
    brief: {
      ...premise(victim, rng),
      where: locWhere(place),
      why: whyLine(subject, victimShort, true, rng),
      goal: goalLine(true, rng),
    },
    segments,
    evidence,
    startEvidence: [homeAttacks[0].id, dep.seam.id],
    deflections,
    concessions,
    resolution: `It was a bluff all the way down. ${K.name[0].toUpperCase() + K.name.slice(1)} never existed — ${homeAttacks[0].short} and ${dep.seam.short} alike had been leaning on that one invention.\n\nWhen it went, everything resting on it went with it. He didn't have a story. He had a keystone, and you found the seam in it.`,
  };
  return { web, leadable: [dep.seam.id, K.seam.id, "iou"] };
}

/** Compose a verified-solvable web plus the leads its phases could gather. */
function composeWeb(seed: number, opts: GenOpts = {}): { web: WebCase; leadable: string[] } {
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = mulberry32((seed + attempt * 7919) >>> 0);
    const keystone = opts.keystone ?? rng() < (opts.weirdness ?? 0);
    if (keystone) {
      const r = buildKeystone(seed + attempt, rng, opts);
      if (verifyWeb(r.web, r.web.startEvidence).solvable) return r;
      continue;
    }
    const leadable: string[] = [];
    const supN = Math.max(1, Math.min(3, opts.supports ?? 2));
    const depth = Math.max(1, Math.min(2, opts.depth ?? 1));

    const supports = shuffle(SUPPORTS, rng).slice(0, supN);
    const attacks = shuffle(ATTACKS, rng).slice(0, Math.max(2, supN));
    const victim = pick(VICTIMS, rng);
    const place = pick(PLACES, rng);
    const subject = pick(SUBJECTS, rng);

    const segments: WebSegment[] = [{ id: "home", name: "the alibi", key: true, base: coreClaim(rng) }];
    const evidence: WebEvidence[] = [];
    const deflections: Record<string, string[]> = {};
    const concessions: Record<string, string> = { home: coreConcession(rng) };

    // attacks all hit the alibi, deflectable through every support
    const supportIds = supports.map((s) => s.id);
    for (const a of attacks) evidence.push({ id: a.id, short: a.short, label: a.label, targets: "home", deflectableBy: [...supportIds] });

    // supports + their seams; optionally make one support deep (propped by another)
    let deepUsed = false;
    for (const s of supports) {
      segments.push({ id: s.id, name: s.name, base: claimLine(s.id, rng) });
      concessions[s.id] = concessionLine(s.id, rng);
      for (const a of attacks) deflections[`${a.id}:${s.id}`] = deflectionPool(3, s.id, a.short, rng);

      const makeDeep = depth >= 2 && !deepUsed && SUPPORTS.length > supN;
      if (makeDeep) {
        deepUsed = true;
        const deep = shuffle(SUPPORTS.filter((x) => !supportIds.includes(x.id)), rng)[0];
        segments.push({ id: deep.id, name: deep.name, base: claimLine(deep.id, rng) });
        concessions[deep.id] = concessionLine(deep.id, rng);
        // this support's seam is now itself deflected by the deeper support
        evidence.push({ id: s.seam.id, short: s.seam.short, label: s.seam.label, targets: s.id, deflectableBy: [deep.id] });
        deflections[`${s.seam.id}:${deep.id}`] = deflectionPool(3, deep.id, s.seam.short, rng);
        // the deeper support has its own clean seam
        evidence.push({ id: deep.seam.id, short: deep.seam.short, label: deep.seam.label, targets: deep.id, deflectableBy: [] });
        leadable.push(deep.seam.id, s.seam.id);
      } else {
        evidence.push({ id: s.seam.id, short: s.seam.short, label: s.seam.label, targets: s.id, deflectableBy: [] });
        leadable.push(s.seam.id);
      }
    }
    leadable.push("iou");

    // a non-key motive thread for flavor
    const mot = motivePick(rng);
    segments.push({ id: "square", name: "the motive", base: mot.claim });
    concessions["square"] = mot.concession;
    evidence.push({ id: "iou", short: mot.evShort, label: mot.evLabel, targets: "square", deflectableBy: [] });

    // optional dead-end lead
    if (opts.herring) {
      const h = pick(HERRINGS, rng);
      segments.push({ id: "noise", name: "a loose end", base: "Whatever else you found means nothing." });
      concessions["noise"] = "...That? That's nothing. I told you it was nothing.";
      evidence.push({ id: h.id, short: h.short, label: h.label, targets: "noise", deflectableBy: [] });
    }

    const victimShort = victim.split(" ").slice(-1)[0];
    const web: WebCase = {
      id: `gen-${seed}`,
      weirdness: opts.weirdness ?? 0.1,
      title: caseTitle(place),
      subject: `${subject}`,
      brief: {
        ...premise(victim, rng),
        where: locWhere(place),
        why: whyLine(subject, victimShort, false, rng),
        goal: goalLine(false, rng),
      },
      segments,
      evidence,
      startEvidence: [attacks[0].id], // worst case: one attack; the rest is recoverable
      deflections,
      concessions,
      resolution: `It came apart from the bottom. ${supports[0].name[0].toUpperCase() + supports[0].name.slice(1)} was the floor under the rest; once it went, ${attacks[0].short} had nothing to stand on.\n\nHe went up that night. What he gave you wasn't an alibi — it was one lie holding up another, and you took out the bottom one.`,
    };

    if (verifyWeb(web, web.startEvidence).solvable) return { web, leadable };
  }
  throw new Error(`composeWeb: could not produce a solvable case for seed ${seed}`);
}

/** Build a verified-solvable web from a seed (confrontation only). */
export function generateWeb(seed: number, opts: GenOpts = {}): WebCase {
  return composeWeb(seed, opts).web;
}

/** Build a full case: generated phases that gather the web's leads, then the web. */
export function generateMergedCase(seed: number, opts: GenOpts = {}): MergedCase {
  const { web, leadable } = composeWeb(seed, opts);
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const leads = leadable.filter((id) => PHASES_BY_SEAM[id]).slice(0, 3);

  const phases: Phase[] = leads.map((seamId, i) => {
    const ph = PHASES_BY_SEAM[seamId];
    const shifts = shiftTriple(seamId, rng);
    const truths = phaseTruths(seamId, rng);
    const statements: PhaseStatement[] = shuffle(
      [
        { id: `l${i}`, text: shifts[0], lie: { shifts, lead: seamId } },
        { id: `t${i}a`, text: truths[0] },
        { id: `t${i}b`, text: truths[1] },
      ],
      rng,
    );
    return { id: `p${i}`, title: `${ROMAN[i]}.  ${ph.title}`, prompt: ph.prompt, statements };
  });

  return {
    id: `m-${seed}`,
    weirdness: web.weirdness,
    title: web.title,
    subject: web.subject,
    brief: web.brief,
    phases,
    startLeads: web.startEvidence,
    web,
    resolution: web.resolution,
  };
}
