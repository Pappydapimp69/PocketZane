/**
 * The interrogation engine. Small, and honest about its one real rule:
 *
 *   The truth holds still. A lie cannot tell itself the same way twice.
 *
 * Constant statements never change. "Unstable" statements (the lies) slip
 * between phrasings when the subject is made to repeat — and the more you PRESS
 * a particular line, the less able it is to hold its shape. Once you have *seen*
 * a line move, it is caught and may be pinned. Pinning a line that never moved
 * is an accusation against the truth, and it costs you.
 */

export interface Statement {
  id: string;
  /** A constant line — context, or a truth that never moves. */
  text?: string;
  /** A lie: phrasings it slips between under repetition. */
  variants?: string[];
}

export interface Case {
  id: string;
  title: string;
  subject: string;
  intro: string;
  statements: Statement[];
  pinsToBreak: number;
  strikes: number;
  resolution: string;
}

export interface LineView {
  id: string;
  text: string;
  unstable: boolean;
  changedNow: boolean;
  caught: boolean;
  pinned: boolean;
  pressed: number; // how hard you've leaned on it (for UI)
}

export type PinResult =
  | { kind: "pinned"; broke: boolean; lines: string[] }
  | { kind: "not-yet" }
  | { kind: "false"; out: boolean }
  | { kind: "already" };

export type Pressure = "LOW" | "MEDIUM" | "HIGH";

const BASE_SLIP = 0.32;
const PRESS_GAIN = 0.5;
const PRESS_SPEND = 0.34; // instability spent each time a line slips
const AGAIN_PRESSURE = 5;
const PRESS_PRESSURE = 11;

export class Interrogation {
  readonly case: Case;
  telling = 1;
  strikesUsed = 0;
  pressure = 0;
  recovered = false; // did the subject just steady themselves on the last telling?

  private shown = new Map<string, number>();
  private instab = new Map<string, number>();
  private seen = new Map<string, string[]>(); // distinct phrasings heard, in order
  private changedNow = new Set<string>();
  private caught = new Set<string>();
  private pinned = new Set<string>();

  constructor(c: Case, private rng: () => number = Math.random) {
    this.case = c;
    for (const s of c.statements) {
      if (s.variants) {
        this.shown.set(s.id, 0);
        this.seen.set(s.id, [s.variants[0]]);
      }
    }
  }

  get pinsDone(): number {
    return this.pinned.size;
  }
  get broken(): boolean {
    return this.pinned.size >= this.case.pinsToBreak;
  }
  get lost(): boolean {
    return this.strikesUsed >= this.case.strikes;
  }
  get state(): Pressure {
    return this.pressure >= 66 ? "HIGH" : this.pressure >= 33 ? "MEDIUM" : "LOW";
  }

  /** Lean on a line so it can't keep its story straight. Costs composure (pressure). */
  press(id: string): boolean {
    const s = this.case.statements.find((x) => x.id === id);
    if (!s || this.pinned.has(id)) return false;
    if (s.variants) this.instab.set(id, Math.min(1.4, (this.instab.get(id) ?? 0) + PRESS_GAIN));
    this.pressure = Math.min(100, this.pressure + PRESS_PRESSURE);
    return !!s.variants;
  }

  /** Make them tell it again. Lies may slip; pressed lines slip harder. */
  again(): string[] {
    this.telling += 1;
    this.changedNow.clear();
    this.recovered = false;

    // Lean too hard and they gather themselves: composure resets, and every
    // line you'd been working loose tightens back up. (What you already caught
    // stays caught — your ledger keeps it.)
    if (this.pressure >= 92) {
      this.recovered = true;
      this.instab.clear();
      this.pressure = 45;
      return [];
    }

    const moved: string[] = [];
    const boost = (this.pressure / 100) * 0.28;

    for (const s of this.case.statements) {
      if (!s.variants || this.pinned.has(s.id)) continue;
      const chance = Math.min(0.95, BASE_SLIP + (this.instab.get(s.id) ?? 0) + boost);
      if (this.rng() < chance) {
        const cur = this.shown.get(s.id) ?? 0;
        const next = this.pickOther(s.variants.length, cur);
        if (next !== cur) {
          this.shown.set(s.id, next);
          this.changedNow.add(s.id);
          this.caught.add(s.id);
          moved.push(s.id);
          const heard = this.seen.get(s.id)!;
          if (!heard.includes(s.variants[next])) heard.push(s.variants[next]);
          this.instab.set(s.id, Math.max(0, (this.instab.get(s.id) ?? 0) - PRESS_SPEND));
        }
      }
    }
    this.pressure = Math.min(100, this.pressure + AGAIN_PRESSURE);
    return moved;
  }

  pin(id: string): PinResult {
    const s = this.case.statements.find((x) => x.id === id);
    if (!s || this.pinned.has(id)) return { kind: "already" };
    if (!s.variants) {
      this.strikesUsed += 1;
      return { kind: "false", out: this.lost };
    }
    if (!this.caught.has(id)) return { kind: "not-yet" };
    this.pinned.add(id);
    return { kind: "pinned", broke: this.broken, lines: this.contradiction(id) };
  }

  /** The distinct phrasings heard for a line — the ledger's quotation. */
  contradiction(id: string): string[] {
    return [...(this.seen.get(id) ?? [])];
  }

  view(): LineView[] {
    return this.case.statements.map((s) => ({
      id: s.id,
      text: s.variants ? s.variants[this.shown.get(s.id) ?? 0] : (s.text ?? ""),
      unstable: !!s.variants,
      changedNow: this.changedNow.has(s.id),
      caught: this.caught.has(s.id),
      pinned: this.pinned.has(s.id),
      pressed: this.instab.get(s.id) ?? 0,
    }));
  }

  private pickOther(n: number, cur: number): number {
    if (n <= 1) return cur;
    let i = Math.floor(this.rng() * (n - 1));
    if (i >= cur) i += 1;
    return i;
  }
}
