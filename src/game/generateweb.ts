import { WebCase, WebSegment, WebEvidence } from "./web";
import { MergedCase, Phase, PhaseStatement } from "./merged";
import { verifyWeb } from "./verify";
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
  claim: string;
  concession: string;
  seam: { id: string; short: string; label: string };
  deflect: string[]; // generic excuse phrasings (reference the attack as "that")
}

const SUPPORTS: SupportT[] = [
  {
    id: "sleep",
    name: "the sleep story",
    claim: "I'd been asleep since before ten. I heard nothing.",
    concession: "...Alright. I was awake — I took the call, from my bed.",
    seam: { id: "call", short: "the call", label: "Phone records: a call from the building at 10:50." },
    deflect: ["I was dead asleep by then — how would I know anything about that?", "Asleep means asleep. That's nothing to do with me.", "Ask someone who was awake. I wasn't."],
  },
  {
    id: "porch",
    name: "the porch",
    claim: "I only stepped onto the porch a moment, for air.",
    concession: "...Fine. I went further than the porch. Up the stairs.",
    seam: { id: "mud", short: "the mud", label: "Mud from the upper landing, dried on his boots." },
    deflect: ["The porch, that's all — anything past that is your guess.", "A man can stand on his own porch. That explains it.", "I stepped out a moment. Nothing more than that."],
  },
  {
    id: "dark",
    name: "the dark stairwell",
    claim: "The stairwell light was out. No one could've seen a thing.",
    concession: "...The light worked. I know it worked.",
    seam: { id: "log", short: "the light log", label: "Maintenance log: the stair light was working that week." },
    deflect: ["In that dark, your witness saw nothing they'd swear to.", "No one sees clearly in an unlit stairwell.", "Whatever they think they saw, the dark says otherwise."],
  },
  {
    id: "visitor",
    name: "the visitor",
    claim: "A friend sat with me the whole evening.",
    concession: "...There was no friend. I was alone all night.",
    seam: { id: "alone", short: "the empty book", label: "The desk's sign-in book: no visitor for him all night." },
    deflect: ["My friend will tell you the same as I do.", "I wasn't alone — ask the man who was with me.", "There's your answer: I had company."],
  },
  {
    id: "drink",
    name: "the drink",
    claim: "I'd had a few. I don't remember the half of it.",
    concession: "...I remember fine. I only hoped you wouldn't ask.",
    seam: { id: "sober", short: "the barman", label: "The barman: he left sober, and early." },
    deflect: ["I'd been drinking — who's to say what I did or didn't?", "Don't hang a man on what he half-remembers.", "Ask the bottle, not me."],
  },
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
];

const CORES = [
  { claim: "I never left my flat that night. Not once.", concession: "...Fine. I went up. He was standing when I left him." },
  { claim: "I never went up those stairs. Not once.", concession: "...Alright. I went up. Only to talk to him." },
  { claim: "I was nowhere near his door all evening.", concession: "...I was at his door. I knocked. That's all." },
];

const HERRINGS = [
  { id: "cig", short: "a cigarette", label: "A cigarette stubbed out by the street door." },
  { id: "smudge", short: "a smudge", label: "A smudge on the bannister, too faint to read." },
];

// Keystones: bluffs with no floor of their own. Many lies lean on one, and when
// its tell is found, the whole structure cascades.
const KEYSTONES: SupportT[] = [
  {
    id: "partner",
    name: "the partner",
    claim: "My partner was beside me the whole night. She'll tell you so.",
    concession: "...There was no partner beside me. I made her up to fill the bed.",
    seam: { id: "sister", short: "her sister", label: "Her sister puts her across town the whole night." },
    deflect: ["My partner will swear to every word of it.", "Ask her — she was right beside me.", "I wasn't alone. That's the end of it."],
  },
  {
    id: "brother",
    name: "the brother's word",
    claim: "My brother was here all evening — he saw the whole of it.",
    concession: "...My brother wasn't here. He'd cover for me, but he wasn't here.",
    seam: { id: "ticket", short: "the ticket stub", label: "A train stub: his brother was three towns over that night." },
    deflect: ["My brother will tell you exactly what I told you.", "He was here. Ask him yourself.", "Family doesn't lie about a thing like this."],
  },
];

const VICTIMS = ["Edmund Carr", "Walter Brill", "Sam Okafor", "Henry Vance", "Leon Pryce"];
const PLACES = ["Wells Street", "Harrow Lane", "Sutter Row", "the Macklin building", "Dover Court"];
const SUBJECTS = ["the downstairs tenant", "the brother-in-law", "the landlord", "the old friend", "the night porter"];

// Question-phase content, keyed by the seam evidence a phase yields. Pinning the
// shifting lie in a phase hands the player that seam.
interface PhaseT {
  title: string;
  prompt: string;
  lieShifts: string[];
  truths: string[];
}
const PHASES_BY_SEAM: Record<string, PhaseT> = {
  call: { title: "The Hour", prompt: "When he turned in. Find the line that drifts.", lieShifts: ["My phone was off the whole night.", "Off, or near enough — I didn't answer it.", "Fine. It rang, and I picked up. From my bed."], truths: ["I turn in early. Always have.", "It was a quiet night, until your knock."] },
  mud: { title: "The Threshold", prompt: "How far he went. Catch the part he keeps shrinking.", lieShifts: ["I never once opened my door.", "I cracked it for air, no more than that.", "Alright — I stepped out onto the landing."], truths: ["I keep my door locked. Always have.", "The hall light's been out for weeks."] },
  log: { title: "What Could Be Seen", prompt: "What the dark hid. Press the certainty.", lieShifts: ["That stairwell's been pitch black a month.", "The light flickered, mostly out.", "It was lit. I only hoped you'd think it wasn't."], truths: ["I've complained about that light before.", "People trip on those stairs all the time."] },
  alone: { title: "The Company", prompt: "Who was with him. Find the friend who wasn't.", lieShifts: ["A friend sat with me all evening.", "He came by for a while, anyway.", "Alright. No one came. I was alone."], truths: ["I don't have many friends to speak of.", "I keep to myself most nights."] },
  sober: { title: "The Drink", prompt: "How clear his head was. Catch the dodge.", lieShifts: ["I'd drunk too much to recall a thing.", "I'd had a couple, that's all.", "I was stone sober. I just didn't want to say."], truths: ["I drink at the same place every week.", "I always walk home, never drive."] },
  sister: { title: "The Corroboration", prompt: "The one who'll vouch for him. Find the crack.", lieShifts: ["My partner was beside me every minute.", "She was in and out, but mostly with me.", "She... she wasn't there. I'll say it."], truths: ["We've been together some years now.", "She sleeps lighter than I do."] },
  ticket: { title: "The Witness", prompt: "His witness. Press until it bends.", lieShifts: ["My brother watched the whole evening with me.", "He was around, in any case.", "He wasn't here. I only wished he were."], truths: ["My brother and I are close.", "He visits when he can."] },
  iou: { title: "The Bad Blood", prompt: "What stood between them. Catch the thing he smooths over.", lieShifts: ["Money never came up between us.", "We may have spoken of it, once.", "He held a marker of mine. Months old."], truths: ["We'd been neighbors a long time.", "We argued about noise, nothing more."] },
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
  const core = pick(CORES, rng);
  const homeAttacks = shuffle(ATTACKS, rng).slice(0, 2);
  const victim = pick(VICTIMS, rng);
  const place = pick(PLACES, rng);
  const subject = pick(SUBJECTS, rng);
  const victimShort = victim.split(" ").slice(-1)[0];

  const segments: WebSegment[] = [
    { id: "home", name: "the alibi", key: true, base: core.claim },
    { id: dep.id, name: dep.name, base: dep.claim },
    { id: K.id, name: K.name, keystone: true, base: K.claim },
    { id: "square", name: "the motive", base: "We were square. I'd no reason to touch him." },
  ];
  const evidence: WebEvidence[] = [];
  const deflections: Record<string, string[]> = {};
  const concessions: Record<string, string> = {
    home: core.concession,
    [dep.id]: dep.concession,
    [K.id]: K.concession,
    square: "...He held a marker of mine. Months overdue, and he'd stopped pretending he'd pay.",
  };
  for (const a of homeAttacks) {
    evidence.push({ id: a.id, short: a.short, label: a.label, targets: "home", deflectableBy: [K.id] });
    deflections[`${a.id}:${K.id}`] = K.deflect;
  }
  evidence.push({ id: dep.seam.id, short: dep.seam.short, label: dep.seam.label, targets: dep.id, deflectableBy: [K.id] });
  deflections[`${dep.seam.id}:${K.id}`] = K.deflect;
  evidence.push({ id: K.seam.id, short: K.seam.short, label: K.seam.label, targets: K.id, deflectableBy: [] });
  evidence.push({ id: "iou", short: "the IOU", label: "An unpaid IOU — his name on it — in the desk.", targets: "square", deflectableBy: [] });

  const web: WebCase = {
    id: `gen-k-${seed}`,
    weirdness: opts.weirdness ?? 0.6,
    title: `The ${place} Stairs`,
    subject,
    brief: {
      what: `${victim} was found dead at the foot of his stairs, his neck broken. It reads like a fall.`,
      where: `His building on ${place}.`,
      when: "The rain ran all night; the fall came between ten and midnight.",
      why: `${subject} lived below ${victimShort}. They argued that evening — and his whole account rests on one corroboration that won't bear weight.`,
      goal: "His story leans hard on one claim. Find the seam in that, and the rest comes down together.",
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
    const core = pick(CORES, rng);
    const victim = pick(VICTIMS, rng);
    const place = pick(PLACES, rng);
    const subject = pick(SUBJECTS, rng);

    const segments: WebSegment[] = [{ id: "home", name: "the alibi", key: true, base: core.claim }];
    const evidence: WebEvidence[] = [];
    const deflections: Record<string, string[]> = {};
    const concessions: Record<string, string> = { home: core.concession };

    // attacks all hit the alibi, deflectable through every support
    const supportIds = supports.map((s) => s.id);
    for (const a of attacks) evidence.push({ id: a.id, short: a.short, label: a.label, targets: "home", deflectableBy: [...supportIds] });

    // supports + their seams; optionally make one support deep (propped by another)
    let deepUsed = false;
    for (const s of supports) {
      segments.push({ id: s.id, name: s.name, base: s.claim });
      concessions[s.id] = s.concession;
      for (const a of attacks) deflections[`${a.id}:${s.id}`] = s.deflect;

      const makeDeep = depth >= 2 && !deepUsed && SUPPORTS.length > supN;
      if (makeDeep) {
        deepUsed = true;
        const deep = shuffle(SUPPORTS.filter((x) => !supportIds.includes(x.id)), rng)[0];
        segments.push({ id: deep.id, name: deep.name, base: deep.claim });
        concessions[deep.id] = deep.concession;
        // this support's seam is now itself deflected by the deeper support
        evidence.push({ id: s.seam.id, short: s.seam.short, label: s.seam.label, targets: s.id, deflectableBy: [deep.id] });
        deflections[`${s.seam.id}:${deep.id}`] = deep.deflect;
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
    segments.push({ id: "square", name: "the motive", base: "We were square. I'd no reason to touch him." });
    concessions["square"] = "...He held a marker of mine. Months overdue, and he'd stopped pretending he'd pay.";
    evidence.push({ id: "iou", short: "the IOU", label: "An unpaid IOU — his name on it — in the desk.", targets: "square", deflectableBy: [] });

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
      title: `The ${place} Stairs`,
      subject: `${subject}`,
      brief: {
        what: `${victim} was found dead at the foot of his stairs, his neck broken. It reads like a fall.`,
        where: `His building on ${place}.`,
        when: "The rain ran all night; the fall came between ten and midnight.",
        why: `${subject} lived below ${victimShort}. They argued that evening — he swears he never left his flat.`,
        goal: "Work him for leads, then break his statement. A head-on hit will only deflect.",
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
    const statements: PhaseStatement[] = shuffle(
      [
        { id: `l${i}`, text: ph.lieShifts[0], lie: { shifts: ph.lieShifts, lead: seamId } },
        { id: `t${i}a`, text: ph.truths[0] },
        { id: `t${i}b`, text: ph.truths[1] },
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
