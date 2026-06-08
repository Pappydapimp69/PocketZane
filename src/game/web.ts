import { mulberry32 } from "./rng";

/**
 * The constraint web (the deeper engine). A cover story is a web of SEGMENTS —
 * interdependent claims. Evidence ATTACKS a segment; but the segment doesn't
 * just concede. If an *intact* segment can serve as an alternate cause, the lie
 * DEFLECTS: it borrows that segment as cover ("I was asleep — how would I know
 * how the coat got wet?"). A deflection is a loan: it commits the suspect harder
 * to the borrowed segment, which becomes the thing to attack. A segment only
 * concedes (breaks) when nothing intact is left to hide behind. You win by
 * bankrupting the supports, then landing the attack the supports were covering.
 *
 * Deterministic. Deflection phrasing is drawn from a seeded grammar that advances
 * every time, so a lie never deflects with the same words twice.
 */

export interface WebSegment {
  id: string;
  name: string; // short label for legibility cues, e.g. "the alibi"
  base: string; // the claim as first stated
  key?: boolean; // breaking the key segment(s) solves the case
}

export interface WebEvidence {
  id: string;
  label: string;
  targets: string; // segment this attacks
  deflectableBy: string[]; // intact segments that can absorb it as an alt-cause
}

export interface WebCase {
  id: string;
  weirdness: number;
  title: string;
  subject: string;
  brief: { what: string; where: string; when: string; why: string; goal: string };
  segments: WebSegment[];
  evidence: WebEvidence[];
  startEvidence: string[];
  /** `${evidenceId}:${deflectorId}` → phrasing pool for the deflection. */
  deflections: Record<string, string[]>;
  /** segmentId → what it says when it finally concedes. */
  concessions: Record<string, string>;
  resolution: string;
}

export interface SegmentView {
  id: string;
  name: string;
  text: string;
  broken: boolean;
  key: boolean;
  leansOn: string | null; // a segment currently propping this one up (legibility)
  propsUp: string[]; // segments currently leaning on this one
}

export type PresentResult =
  | { kind: "deflect"; target: string; via: string; text: string; revealed?: WebEvidence }
  | { kind: "break"; target: string; key: boolean; solved: boolean }
  | { kind: "already" }
  | { kind: "spent" }
  | { kind: "nomatch" };

export class WebInquiry {
  readonly case: WebCase;
  private broken = new Set<string>();
  private leans = new Map<string, string>(); // target → deflector it currently leans on
  private text = new Map<string, string>(); // current rendered text per segment
  private held = new Set<string>();
  private rng: () => number;
  private tick = 0;

  constructor(c: WebCase, seed = 1, initialHeld?: string[]) {
    this.case = c;
    (initialHeld ?? c.startEvidence).forEach((e) => this.held.add(e));
    c.segments.forEach((s) => this.text.set(s.id, s.base));
    this.rng = mulberry32(seed);
  }

  heldEvidence(): WebEvidence[] {
    return this.case.evidence.filter((e) => this.held.has(e.id));
  }

  segments(): SegmentView[] {
    return this.case.segments.map((s) => ({
      id: s.id,
      name: s.name,
      text: this.text.get(s.id) ?? s.base,
      broken: this.broken.has(s.id),
      key: !!s.key,
      leansOn: this.leans.get(s.id) ?? null,
      propsUp: [...this.leans.entries()].filter(([, d]) => d === s.id).map(([t]) => t),
    }));
  }

  segmentName(id: string): string {
    return this.case.segments.find((s) => s.id === id)?.name ?? id;
  }

  get total(): number {
    return this.case.segments.filter((s) => s.key).length;
  }
  get brokenCount(): number {
    return this.case.segments.filter((s) => s.key && this.broken.has(s.id)).length;
  }
  get solved(): boolean {
    return this.case.segments.filter((s) => s.key).every((s) => this.broken.has(s.id));
  }

  /** Present a held lead against its target. Deflects through an intact support, or breaks. */
  present(evId: string): PresentResult {
    const ev = this.case.evidence.find((e) => e.id === evId);
    if (!ev || !this.held.has(evId)) return { kind: "nomatch" };
    const t = ev.targets;
    if (this.broken.has(t)) return { kind: "already" };

    const cover = ev.deflectableBy.filter((d) => !this.broken.has(d));
    if (cover.length > 0) {
      const via = cover[0];
      this.leans.set(t, via);
      const pool = this.case.deflections[`${ev.id}:${via}`] ?? [`(${via})`];
      const line = pool[Math.floor(this.rng() * pool.length) % pool.length];
      this.tick += 1;
      this.text.set(t, line);
      // Recovery: leaning on a support exposes that support's weakness — hand the
      // player the lead that breaks it, if they don't already hold it.
      let revealed: WebEvidence | undefined;
      const breaker = this.case.evidence.find((e) => e.targets === via && !this.held.has(e.id));
      if (breaker) {
        this.held.add(breaker.id);
        revealed = breaker;
      }
      return { kind: "deflect", target: t, via, text: line, revealed };
    }

    // Nothing left to hide behind — it concedes.
    this.broken.add(t);
    this.leans.delete(t);
    this.text.set(t, this.case.concessions[t] ?? this.text.get(t) ?? "");
    return { kind: "break", target: t, key: !!this.case.segments.find((s) => s.id === t)?.key, solved: this.solved };
  }
}
