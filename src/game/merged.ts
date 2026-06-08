import { WebInquiry, WebCase, SegmentView, PresentResult } from "./web";

/**
 * The merged loop: three QUESTION PHASES gather leads (catch the line that
 * shifts; three wrong accusations fail the phase, you keep what you got), then a
 * CONFRONTATION that is the constraint web — present the leads you hold, the lie
 * deflects through its supports, and you win by bankrupting the supports. Leads
 * gathered in the phases are exactly the evidence you carry into the web; a
 * failed phase is recoverable, because leaning on a support exposes it.
 */

export const PHASE_STRIKES = 3;

export interface PhaseStatement {
  id: string;
  text: string;
  lie?: { shifts: string[]; lead: string }; // shifts[0] === text; `lead` = web evidence id
}
export interface Phase {
  id: string;
  title: string;
  prompt: string;
  statements: PhaseStatement[];
}

export interface MergedCase {
  id: string;
  weirdness: number;
  title: string;
  subject: string;
  brief: { what: string; where: string; when: string; why: string; goal: string };
  phases: Phase[];
  startLeads: string[]; // web evidence held before the phases
  web: WebCase; // the confrontation (its startEvidence is ignored; we seed from leads)
  resolution: string;
}

export interface PhaseLineView {
  id: string;
  text: string;
  isLie: boolean;
  shifted: boolean;
  pinned: boolean;
}
export type PinResult =
  | { kind: "lead"; leadId: string; phaseDone: boolean }
  | { kind: "not-caught" }
  | { kind: "strike"; strikes: number; failed: boolean }
  | { kind: "already" };

export class MergedInquiry {
  readonly case: MergedCase;
  phaseIdx = 0;
  confronting = false;

  private shifted = new Set<string>();
  private shiftPos = new Map<string, number>();
  private pinned = new Set<string>();
  private strikes = 0;
  private gathered = new Set<string>();
  private web: WebInquiry | null = null;
  private seed: number;

  constructor(c: MergedCase, seed = 1) {
    this.case = c;
    this.seed = seed;
    c.startLeads.forEach((l) => this.gathered.add(l));
  }

  // ---- phases ----------------------------------------------------------------

  get phase(): Phase {
    return this.case.phases[this.phaseIdx];
  }
  get phaseStrikes(): number {
    return this.strikes;
  }
  get leadCount(): number {
    return this.gathered.size;
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

  question(id: string): { shifted: boolean } {
    const s = this.phase.statements.find((x) => x.id === id);
    if (!s || !s.lie || this.pinned.has(id)) return { shifted: false };
    const pos = this.shiftPos.get(id) ?? 0;
    this.shiftPos.set(id, Math.min(pos + 1, s.lie.shifts.length - 1));
    this.shifted.add(id);
    return { shifted: true };
  }

  pin(id: string): PinResult {
    const s = this.phase.statements.find((x) => x.id === id);
    if (!s || this.pinned.has(id)) return { kind: "already" };
    if (s.lie) {
      if (!this.shifted.has(id)) return { kind: "not-caught" };
      this.pinned.add(id);
      this.gathered.add(s.lie.lead);
      return { kind: "lead", leadId: s.lie.lead, phaseDone: this.phaseCleared() };
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

  advance(): void {
    if (this.phaseIdx + 1 < this.case.phases.length) {
      this.phaseIdx += 1;
      this.shifted.clear();
      this.shiftPos.clear();
      this.pinned.clear();
      this.strikes = 0;
    } else {
      this.confronting = true;
      this.web = new WebInquiry(this.case.web, this.seed, [...this.gathered]);
    }
  }

  leadLabel(id: string): string {
    return this.case.web.evidence.find((e) => e.id === id)?.label ?? id;
  }

  // ---- confrontation (delegates to the web) ----------------------------------

  private w(): WebInquiry {
    if (!this.web) throw new Error("not confronting yet");
    return this.web;
  }
  segments(): SegmentView[] {
    return this.w().segments();
  }
  segmentName(id: string): string {
    return this.w().segmentName(id);
  }
  heldEvidence() {
    return this.w().heldEvidence();
  }
  present(evId: string): PresentResult {
    return this.w().present(evId);
  }
  get brokenCount(): number {
    return this.web ? this.web.brokenCount : 0;
  }
  get total(): number {
    return this.web ? this.web.total : this.case.web.segments.filter((s) => s.key).length;
  }
  get solved(): boolean {
    return this.web ? this.web.solved : false;
  }
}
