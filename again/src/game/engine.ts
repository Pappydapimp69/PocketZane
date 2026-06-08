/**
 * The interrogation engine. Deliberately small. One real rule:
 *
 *   The truth holds still. A lie cannot tell itself the same way twice.
 *
 * Constant statements never change. "Unstable" statements (the lies) re-roll
 * their wording when you ask the subject to tell it AGAIN. Once you have *seen*
 * a statement change, you have caught it and may pin it. Pinning a constant is a
 * false accusation — the subject steadies, and it costs you.
 */

export interface Statement {
  id: string;
  /** A constant line — context or a truth that never moves. */
  text?: string;
  /** A lie: two (or more) phrasings it slips between under repetition. */
  variants?: string[];
}

export interface Case {
  id: string;
  title: string;
  subject: string;
  intro: string;
  /** Lines spoken, in order. */
  statements: Statement[];
  /** Contradictions needed to break the story. */
  pinsToBreak: number;
  /** Strikes (false accusations) allowed before the subject walks. */
  strikes: number;
  /** The truth, revealed when the story breaks. Declarative. */
  resolution: string;
}

export interface LineView {
  id: string;
  text: string;
  unstable: boolean;
  changedNow: boolean; // moved on the most recent telling
  caught: boolean; // has ever moved (pinnable)
  pinned: boolean;
}

export type PinResult =
  | { kind: "pinned"; broke: boolean }
  | { kind: "not-yet" } // it's a lie but you haven't seen it move
  | { kind: "false"; out: boolean } // you accused the truth
  | { kind: "already" };

/** Chance an unstable line slips on a given retelling. */
const SLIP = 0.6;

export class Interrogation {
  readonly case: Case;
  telling = 1;
  strikesUsed = 0;

  private shown = new Map<string, number>(); // variant index currently displayed
  private changedNow = new Set<string>();
  private caught = new Set<string>();
  private pinned = new Set<string>();

  constructor(c: Case, private rng: () => number = Math.random) {
    this.case = c;
    for (const s of c.statements) if (s.variants) this.shown.set(s.id, 0);
  }

  get pinsLeft(): number {
    return Math.max(0, this.case.pinsToBreak - this.pinned.size);
  }
  get broken(): boolean {
    return this.pinned.size >= this.case.pinsToBreak;
  }
  get lost(): boolean {
    return this.strikesUsed >= this.case.strikes;
  }

  /** Ask the subject to tell it again; lies may slip. Returns lines that moved. */
  again(): string[] {
    this.telling += 1;
    this.changedNow.clear();
    const moved: string[] = [];
    for (const s of this.case.statements) {
      if (!s.variants || this.pinned.has(s.id)) continue;
      if (this.rng() < SLIP) {
        const cur = this.shown.get(s.id) ?? 0;
        const next = this.pickOther(s.variants.length, cur);
        if (next !== cur) {
          this.shown.set(s.id, next);
          this.changedNow.add(s.id);
          this.caught.add(s.id);
          moved.push(s.id);
        }
      }
    }
    return moved;
  }

  pin(id: string): PinResult {
    const s = this.case.statements.find((x) => x.id === id);
    if (!s) return { kind: "already" };
    if (this.pinned.has(id)) return { kind: "already" };

    const isLie = !!s.variants;
    if (!isLie) {
      this.strikesUsed += 1;
      return { kind: "false", out: this.lost };
    }
    if (!this.caught.has(id)) return { kind: "not-yet" };

    this.pinned.add(id);
    return { kind: "pinned", broke: this.broken };
  }

  view(): LineView[] {
    return this.case.statements.map((s) => ({
      id: s.id,
      text: s.variants ? s.variants[this.shown.get(s.id) ?? 0] : (s.text ?? ""),
      unstable: !!s.variants,
      changedNow: this.changedNow.has(s.id),
      caught: this.caught.has(s.id),
      pinned: this.pinned.has(s.id),
    }));
  }

  private pickOther(n: number, cur: number): number {
    if (n <= 1) return cur;
    let i = Math.floor(this.rng() * (n - 1));
    if (i >= cur) i += 1;
    return i;
  }
}
