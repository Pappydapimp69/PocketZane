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
  keystone?: boolean; // a bluff: breaking it cascades everything leaning on it
}

export interface WebEvidence {
  id: string;
  label: string;
  short?: string; // a short tag for the win diagram, e.g. "the coat"
  targets: string; // segment this attacks
  deflectableBy: string[]; // intact segments that can absorb it as an alt-cause
}

export interface WebCase {
  id: string;
  weirdness: number;
  title: string;
  subject: string;
  victim?: string; // the victim's short name, for in-character references
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

/** A fresh lie spun the moment a prop is broken — a new segment that re-covers
 *  the hole and must itself be broken. Self-revealing: its seam is handed over. */
export interface Patch {
  seg: string; // the new segment's id
  name: string; // its short label
  claim: string; // what he now says
  breaker: string; // the lead (now held) that breaks it
  breakerLabel: string;
}

export type PresentResult =
  | { kind: "deflect"; target: string; via: string; text: string; revealed?: WebEvidence }
  | { kind: "break"; target: string; key: boolean; solved: boolean; keystone?: boolean; cascaded?: string[]; patched?: Patch }
  | { kind: "already" }
  | { kind: "spent" }
  | { kind: "nomatch" };

const PATCH_CLAIMS = [
  "No — now it comes back to me. {who} can put me elsewhere; ask them.",
  "That proves nothing. I'd lent it out that week — it wasn't on me.",
  "You've got the night wrong. That was the evening before; I can show you.",
  "Then someone moved it. I never touched it after supper, I swear it.",
  "Fine — I wasn't where I said. But I was with {who} the whole while.",
];
const PATCH_WHO = ["my brother", "the landlady", "a man at the bar", "my sister", "the night porter", "an old friend"];
const PATCH_SEAMS = [
  "the times don't line up",
  "that one won't back him either",
  "the ledger says otherwise",
  "no one remembers him there",
  "the receipt is dated wrong",
];
const PATCH_NAMES = ["his new story", "the second alibi", "his fresh excuse", "the patch"];

export class WebInquiry {
  readonly case: WebCase;
  private broken = new Set<string>();
  private leans = new Map<string, string>(); // target → deflector it currently leans on
  private text = new Map<string, string>(); // current rendered text per segment
  private held = new Set<string>();
  private pressed = new Set<string>(); // segments an attack has deflected on
  private rng: () => number;
  private tick = 0;
  // ---- runtime patches: lies he invents the moment he's cornered ----
  private patchOn: boolean;
  private extraSeg: WebSegment[] = []; // segments spun up at runtime
  private extraEv: WebEvidence[] = []; // their (self-revealed) breakers
  private deflOverride = new Map<string, string[]>(); // evId → effective deflectableBy
  private patchedFrom = new Set<string>(); // props that have already patched once

  constructor(c: WebCase, seed = 1, initialHeld?: string[], initialBroken?: string[], patch = false) {
    this.case = c;
    this.patchOn = patch;
    (initialHeld ?? c.startEvidence).forEach((e) => this.held.add(e));
    c.segments.forEach((s) => this.text.set(s.id, s.base));
    // Props caught in the interview arrive already conceded.
    (initialBroken ?? []).forEach((id) => {
      this.broken.add(id);
      this.text.set(id, c.concessions[id] ?? c.segments.find((s) => s.id === id)?.base ?? "");
    });
    this.rng = mulberry32(seed);
  }

  /** Every segment in the live web — the authored case plus any runtime patches. */
  private allSegments(): WebSegment[] {
    return [...this.case.segments, ...this.extraSeg];
  }
  private allEvidence(): WebEvidence[] {
    return [...this.case.evidence, ...this.extraEv];
  }
  private effectiveDefl(e: WebEvidence): string[] {
    return this.deflOverride.get(e.id) ?? e.deflectableBy;
  }

  heldEvidence(): WebEvidence[] {
    return this.allEvidence().filter((e) => this.held.has(e.id));
  }

  segments(): SegmentView[] {
    return this.allSegments().map((s) => ({
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
    return this.allSegments().find((s) => s.id === id)?.name ?? id;
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
    const ev = this.allEvidence().find((e) => e.id === evId);
    if (!ev || !this.held.has(evId)) return { kind: "nomatch" };
    const t = ev.targets;
    if (this.broken.has(t)) return { kind: "already" };

    const cover = this.effectiveDefl(ev).filter((d) => !this.broken.has(d));
    if (cover.length > 0) {
      const via = cover[0];
      this.leans.set(t, via);
      this.pressed.add(t);
      const pool = this.case.deflections[`${ev.id}:${via}`] ?? [`(${via})`];
      const line = pool[Math.floor(this.rng() * pool.length) % pool.length];
      this.tick += 1;
      this.text.set(t, line);
      // Recovery: leaning on a support exposes that support's weakness — hand the
      // player the lead that breaks it, if they don't already hold it.
      let revealed: WebEvidence | undefined;
      const breaker = this.allEvidence().find((e) => e.targets === via && !this.held.has(e.id));
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
    const seg = this.allSegments().find((s) => s.id === t);
    // A keystone is a bluff: when it falls, everything it propped falls with it.
    const cascaded = seg?.keystone ? this.cascade() : undefined;
    // Cornered, he may invent a NEW lie that re-covers the hole this prop left.
    const patched = cascaded ? undefined : this.tryPatch(t);
    return { kind: "break", target: t, key: !!seg?.key, solved: this.solved, keystone: !!seg?.keystone, cascaded, patched };
  }

  /** When a support that was covering a key attack breaks, the suspect scrambles:
   *  he spins a fresh claim that slides in to re-cover that same attack. The new
   *  claim is a real segment with its own (immediately handed-over) seam, so the
   *  player must break it too before the key concedes. Bounded — a prop patches at
   *  most once, and a patch's own segment never patches — so it always terminates. */
  private tryPatch(brokenId: string): Patch | undefined {
    if (!this.patchOn) return undefined;
    if (brokenId.startsWith("patch_")) return undefined; // patches don't re-patch
    if (this.patchedFrom.has(brokenId)) return undefined;
    // find a key attack this prop was covering that still stands
    const ke = this.case.evidence.find((e) => {
      const k = this.case.segments.find((s) => s.id === e.targets);
      return !!k?.key && !this.broken.has(e.targets) && this.effectiveDefl(e).includes(brokenId);
    });
    if (!ke) return undefined;
    this.patchedFrom.add(brokenId);

    const segId = `patch_${brokenId}`;
    const breakerId = `pe_${brokenId}`;
    const who = PATCH_WHO[Math.floor(this.rng() * PATCH_WHO.length)];
    const claim = PATCH_CLAIMS[Math.floor(this.rng() * PATCH_CLAIMS.length)].replace("{who}", who);
    const name = PATCH_NAMES[Math.floor(this.rng() * PATCH_NAMES.length)];
    const breakerLabel = PATCH_SEAMS[Math.floor(this.rng() * PATCH_SEAMS.length)];

    this.extraSeg.push({ id: segId, name, base: claim });
    this.text.set(segId, claim);
    // the new claim slides in to re-cover the key attack
    this.deflOverride.set(ke.id, [...this.effectiveDefl(ke).filter((d) => d !== brokenId), segId]);
    // and its seam is reachable straight away — you hold the lead that breaks it
    this.extraEv.push({ id: breakerId, label: breakerLabel, targets: segId, deflectableBy: [] });
    this.held.add(breakerId);

    return { seg: segId, name, claim, breaker: breakerId, breakerLabel };
  }

  private deflectorsOf(id: string): string[] {
    const s = new Set<string>();
    for (const e of this.case.evidence) if (e.targets === id) e.deflectableBy.forEach((d) => s.add(d));
    return [...s];
  }

  /** After a keystone falls, collapse every pressed segment left with no cover. */
  private cascade(): string[] {
    const out: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const seg of this.case.segments) {
        if (this.broken.has(seg.id) || !this.pressed.has(seg.id)) continue;
        const defl = this.deflectorsOf(seg.id);
        if (defl.length > 0 && defl.every((d) => this.broken.has(d))) {
          this.broken.add(seg.id);
          this.leans.delete(seg.id);
          this.text.set(seg.id, this.case.concessions[seg.id] ?? this.text.get(seg.id) ?? "");
          out.push(seg.id);
          changed = true;
        }
      }
    }
    return out;
  }
}
