/**
 * Deduction engine v2 — phases + a leveled confrontation.
 *
 * A case has a hidden truth, defended by FACTS (each with a `resistance`). The
 * subject's lies are pressure on those facts: a LEAD applies `weight` to one or
 * more facts (a lead attacks *content*, not a sentence, so it can touch several
 * claims). You gather leads in three QUESTION PHASES (catch the statement that
 * shifts — but three wrong accusations and the subject walks the phase). Then in
 * the CONFRONTATION the subject gives one integrated statement; you PRESENT leads
 * to pile pressure on a fact. Under its resistance a press only dents the story
 * (a rebuttal, a reveal); once stacked pressure meets the resistance, the claims
 * resting on that fact collapse. A partial press can also surface a lead you
 * failed to gather — nothing is permanently lost.
 *
 * Deterministic and offline. `weirdness` (0..1) biases future generation.
 */

export interface Brief {
  what: string;
  where: string;
  when: string;
  why: string;
  goal: string;
}

export interface FactDef {
  id: string;
  resistance: number;
}

export interface LeadApply {
  fact: string;
  weight: number;
  rebuttal: string; // what he says when this press lands but doesn't yet break it
}

export interface Lead {
  id: string;
  label: string;
  applies: LeadApply[];
}

/** A line in a question phase: a stable truth, or a lie that shifts when pressed. */
export interface PhaseStatement {
  id: string;
  text: string; // initial / stable text
  lie?: { shifts: string[]; lead: string }; // if present, it's a lie; shifts[0] should equal text
}

export interface Phase {
  id: string;
  title: string;
  prompt: string;
  statements: PhaseStatement[];
}

export interface ConfClaim {
  id: string;
  text: string;
  fact: string; // the load-bearing fact this sentence defends
  key?: boolean;
  rebuttals: string[]; // successive phrasings as partial pressure mounts
  revealsOnPartial?: string; // a lead recovered on the first partial here
}

export interface DCase {
  id: string;
  weirdness: number;
  title: string;
  subject: string;
  brief: Brief;
  facts: FactDef[];
  leads: Lead[];
  startLeads: string[];
  phases: Phase[];
  confront: { intro: string; claims: ConfClaim[] };
  resolution: string;
}

export const PHASE_STRIKES = 3;

export interface PhaseLineView {
  id: string;
  text: string;
  isLie: boolean;
  shifted: boolean;
  pinned: boolean;
}

export interface ClaimView {
  id: string;
  text: string;
  fact: string;
  key: boolean;
  broken: boolean;
}

export type PinResult =
  | { kind: "lead"; lead: Lead; phaseDone: boolean }
  | { kind: "not-caught" }
  | { kind: "strike"; strikes: number; failed: boolean }
  | { kind: "already" };

export type PresentResult =
  | { kind: "break"; solved: boolean }
  | { kind: "partial"; claimText: string; revealed?: Lead }
  | { kind: "nomatch" }
  | { kind: "spent" }
  | { kind: "already" };

export class Inquiry {
  readonly case: DCase;

  // mode
  phaseIdx = 0;
  confronting = false;

  // phase state
  private shifted = new Set<string>();
  private shiftPos = new Map<string, number>();
  private pinned = new Set<string>();
  private strikes = 0;

  // gathered + confrontation state
  private held = new Set<string>();
  private pressure = new Map<string, number>();
  private applied = new Set<string>(); // `${leadId}:${fact}`
  private broken = new Set<string>();
  private partials = new Map<string, number>();

  constructor(c: DCase) {
    this.case = c;
    c.startLeads.forEach((l) => this.held.add(l));
  }

  // ---- phases ---------------------------------------------------------------

  get phase(): Phase {
    return this.case.phases[this.phaseIdx];
  }
  get phaseStrikes(): number {
    return this.strikes;
  }

  phaseLines(): PhaseLineView[] {
    return this.phase.statements.map((s) => ({
      id: s.id,
      text: s.lie ? s.lie.shifts[this.shiftPos.get(s.id) ?? 0] : s.text,
      isLie: !!s.lie,
      shifted: this.shifted.has(s.id),
      pinned: this.pinned.has(s.id),
    }));
  }

  /** Press a phase line. A lie shifts to its next phrasing; a truth just holds. */
  question(id: string): { shifted: boolean } {
    const s = this.phase.statements.find((x) => x.id === id);
    if (!s || !s.lie || this.pinned.has(id)) return { shifted: false };
    const pos = this.shiftPos.get(id) ?? 0;
    const next = Math.min(pos + 1, s.lie.shifts.length - 1);
    this.shiftPos.set(id, next);
    this.shifted.add(id);
    return { shifted: true };
  }

  /** Accuse a phase line of being a lie. Right = a lead; a truth = a strike. */
  pin(id: string): PinResult {
    const s = this.phase.statements.find((x) => x.id === id);
    if (!s || this.pinned.has(id)) return { kind: "already" };
    if (s.lie) {
      if (!this.shifted.has(id)) return { kind: "not-caught" };
      this.pinned.add(id);
      const lead = this.case.leads.find((l) => l.id === s.lie!.lead)!;
      this.held.add(lead.id);
      return { kind: "lead", lead, phaseDone: this.phaseCleared() };
    }
    this.strikes += 1;
    return { kind: "strike", strikes: this.strikes, failed: this.strikes >= PHASE_STRIKES };
  }

  private phaseCleared(): boolean {
    return this.phase.statements.filter((s) => s.lie).every((s) => this.pinned.has(s.id));
  }
  get phaseOver(): boolean {
    return this.phaseCleared() || this.strikes >= PHASE_STRIKES;
  }

  /** Move to the next phase, or into the confrontation. Resets phase-local state. */
  advance(): void {
    if (this.phaseIdx + 1 < this.case.phases.length) {
      this.phaseIdx += 1;
      this.shifted.clear();
      this.shiftPos.clear();
      this.pinned.clear();
      this.strikes = 0;
    } else {
      this.confronting = true;
    }
  }

  // ---- confrontation --------------------------------------------------------

  claims(): ClaimView[] {
    return this.case.confront.claims.map((c) => ({
      id: c.id,
      text: this.claimText(c),
      fact: c.fact,
      key: !!c.key,
      broken: this.broken.has(c.id),
    }));
  }

  private claimText(c: ConfClaim): string {
    const p = this.partials.get(c.id) ?? 0;
    if (p === 0) return c.text;
    return c.rebuttals[Math.min(p - 1, c.rebuttals.length - 1)];
  }

  heldLeads(): Lead[] {
    return this.case.leads.filter((l) => this.held.has(l.id));
  }
  leadUsedOn(leadId: string, fact: string): boolean {
    return this.applied.has(`${leadId}:${fact}`);
  }
  private resistance(fact: string): number {
    return this.case.facts.find((f) => f.id === fact)?.resistance ?? 99;
  }
  get keyClaims(): ConfClaim[] {
    return this.case.confront.claims.filter((c) => c.key);
  }
  get brokenCount(): number {
    return this.keyClaims.filter((c) => this.broken.has(c.id)).length;
  }
  get total(): number {
    return this.keyClaims.length;
  }
  get solved(): boolean {
    return this.keyClaims.every((c) => this.broken.has(c.id));
  }

  /** Present a held lead against a claim. Stacks pressure on the claim's fact. */
  present(claimId: string, leadId: string): PresentResult {
    const c = this.case.confront.claims.find((x) => x.id === claimId);
    if (!c) return { kind: "nomatch" };
    if (this.broken.has(claimId)) return { kind: "already" };
    const lead = this.case.leads.find((l) => l.id === leadId);
    if (!lead || !this.held.has(leadId)) return { kind: "nomatch" };
    const ap = lead.applies.find((a) => a.fact === c.fact);
    if (!ap) return { kind: "nomatch" };
    const key = `${leadId}:${c.fact}`;
    if (this.applied.has(key)) return { kind: "spent" };

    this.applied.add(key);
    this.pressure.set(c.fact, (this.pressure.get(c.fact) ?? 0) + ap.weight);

    if ((this.pressure.get(c.fact) ?? 0) >= this.resistance(c.fact)) {
      // The fact caves — every claim resting on it falls.
      for (const cl of this.case.confront.claims) if (cl.fact === c.fact) this.broken.add(cl.id);
      return { kind: "break", solved: this.solved };
    }

    // Partial: the sentence bends, and may cough up a lead you'd missed.
    this.partials.set(claimId, (this.partials.get(claimId) ?? 0) + 1);
    let revealed: Lead | undefined;
    if (c.revealsOnPartial && !this.held.has(c.revealsOnPartial)) {
      this.held.add(c.revealsOnPartial);
      revealed = this.case.leads.find((l) => l.id === c.revealsOnPartial);
    }
    return { kind: "partial", claimText: this.claimText(c), revealed };
  }
}
