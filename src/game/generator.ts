import { Case, Statement } from "./engine";
import { randomTemperament } from "./temperaments";

/**
 * Procedural case generation for the endless mode ("an endless night"). Cases
 * are assembled from a pool of claim templates — constant truths and unstable
 * lies (some with hard evidence). Every generated case is winnable by
 * construction: each lie carries two or more phrasings, so it can always slip.
 */

const SUBJECTS = [
  "the tenant",
  "the friend",
  "the witness",
  "the driver",
  "the neighbor",
  "the clerk",
  "the stranger",
  "the one who called it in",
];

const CONSTANTS: string[] = [
  "It rained that night. That part holds.",
  "I came in on my own.",
  "I've nothing to gain by being here.",
  "Write it down — all of it.",
  "I knew them, years back. That doesn't change.",
  "I've told you what I know.",
];

interface LieTemplate {
  variants: string[];
  evidence?: string;
}

const LIES: LieTemplate[] = [
  { variants: ["I was home by ten.", "I was home by midnight.", "I was home — I don't watch clocks."] },
  { variants: ["The door was locked.", "The door was open when I got there.", "I never checked the door."] },
  { variants: ["I was alone.", "There was someone with me.", "I think I was alone."] },
  { variants: ["No one called me.", "One call came. I let it ring.", "My phone was off all night."] },
  { variants: ["I hadn't been drinking.", "I'd had one. Maybe two."] },
  { variants: ["I saw nothing.", "I saw someone leave.", "I saw lights, that's all."] },
  { variants: ["I heard nothing.", "I heard a car, late.", "I heard them arguing."] },
  { variants: ["My coat was dry.", "My coat was damp, from earlier."], evidence: "The coat was logged wet." },
  { variants: ["I never touched the register.", "I opened it once, for change."], evidence: "The drawer carries your prints." },
  { variants: ["I took the main road home.", "I cut through the back lots."] },
  { variants: ["I left at eleven.", "I left closer to one.", "I don't remember leaving."] },
  { variants: ["I'd never met them.", "We'd spoken once, briefly."] },
  { variants: ["The lights were off.", "A light was on in the back."] },
  { variants: ["I don't have a key.", "I had a key, but I never used it."], evidence: "A key with your tag was in the lock." },
];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a fresh case. `depth` (0+) ratchets difficulty. Pass a seeded `rng` for reproducible cases. */
export function generateCase(depth: number, rng: () => number = Math.random): Case {
  const lieCount = Math.min(7, 4 + depth);
  const constCount = 3;
  const pins = Math.min(lieCount - 1, 3 + Math.floor(depth / 2));
  const strikes = Math.max(2, 3 - Math.floor(depth / 3));

  const lies = shuffle(LIES, rng).slice(0, lieCount);
  const consts = shuffle(CONSTANTS, rng).slice(0, constCount);

  const statements: Statement[] = [];
  lies.forEach((l, i) => statements.push({ id: `l${i}`, variants: l.variants, evidence: l.evidence }));
  consts.forEach((t, i) => statements.push({ id: `c${i}`, text: t }));

  const ordered = shuffle(statements, rng);
  const subject = SUBJECTS[Math.floor(rng() * SUBJECTS.length)];

  return {
    id: `gen-${depth}-${Math.floor(Math.random() * 1e6)}`,
    title: `Night ${depth + 1}`,
    subject,
    intro: "Another one sits down. You know how this goes. Ask them to tell it. Then ask again.",
    statements: ordered,
    pinsToBreak: pins,
    strikes,
    temperament: randomTemperament(rng),
    resolution:
      `The truth held. The rest did not.\n\nYou asked, and asked again, and the account rearranged itself each time — ${pins} details that couldn't agree with themselves, and under them the shape of a night someone needed to be a different night.\n\nAn arrow travels in only one direction. This telling kept trying to travel back.`,
  };
}
