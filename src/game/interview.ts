import { WebCase, WebInquiry, WebEvidence } from "./web";
import { questionLie, questionLever, leverReaction, patchLine, dudExchange, tellFor, keystoneQuestion } from "./phrasing";

/**
 * The interview (Act 1), the new front half of the game. The detective is given
 * FIVE questions but only THREE rounds — two questions always go unasked, and
 * those gaps become the suspect's cover in the confrontation. Each question is
 * one of:
 *   - a LIE: he tells a propping claim. You crack it by holding the LEVER for it,
 *     or by a TELL that contradicts it — and cracking it pre-breaks that prop and
 *     makes him patch the hole with a fresh lie.
 *   - a LEVER: he lets slip a record that breaks one of his lies — your ammo.
 *   - a TELL: an innocuous answer that conflicts with one of his lies (his own
 *     words); connect the two to crack the lie with no record.
 *   - a KEYSTONE: in a keystone case, who vouches for him — unbreakable here;
 *     asking it plants a suspicion that carries into the confrontation.
 *   - a DUD: character, no purchase. Spend a round on it and you've wasted it.
 *
 * The web is still generated and verified solvable; the interview only changes
 * what you walk into the confrontation already holding (leads) and already
 * having toppled (caught props). Deterministic.
 */

export type QuestionKind = "lie" | "lever" | "tell" | "dud" | "keystone";

export interface Question {
  id: string;
  ask: string; // the detective's question
  kind: QuestionKind;
  answer: string; // his immediate reply
  seg?: string; // (lie) the prop segment this claim is | (tell) the lie it conflicts with
  leverId?: string; // (lie) the evidence that cracks it
  patch?: string; // (lie) what he says when caught
  evId?: string; // (lever) evidence handed to you
  clash?: string; // (tell) why this answer doesn't square with the lie it targets
}

export const ROUNDS = 3;

/** Derive the five questions from the verified web: lie/lever pairs for the
 *  surface props (never the keystone — that stays the confrontation's payoff),
 *  padded with duds. Deterministic given the rng. */
export function buildQuestions(web: WebCase, rng: () => number): Question[] {
  const cleanBreaker = (segId: string): WebEvidence | undefined =>
    web.evidence.find((e) => e.targets === segId && e.deflectableBy.length === 0);
  const claimOf = (segId: string) => web.segments.find((s) => s.id === segId)!.base;

  // SUPPORTS carry a "tell" (an own-words contradiction); the motive does not.
  // They can be cracked by the tell whether or not their seam is a clean lever,
  // so the contradiction always lands on a support with in-character clash text —
  // even in keystone cases, where a support's seam is itself deflectable.
  const supports = web.segments.filter((s) => !s.key && !s.keystone && s.id !== "noise" && s.id !== "square").map((s) => s.id);
  // LEVER props are anything with a clean external breaker (supports + the motive).
  const leverProps = web.segments.filter((s) => !s.key && !s.keystone && s.id !== "noise").map((s) => ({ seg: s.id, lever: cleanBreaker(s.id) })).filter((p): p is { seg: string; lever: WebEvidence } => !!p.lever);

  const out: Question[] = [];

  // The CONTRADICTION pair: his lie + a "tell" he gives elsewhere that conflicts.
  // No record needed — the only way to catch it in the interview is to connect
  // his own two answers. This is the self-incriminating instability the goal wants.
  // WHICH support carries it is seeded, so the unstable prop — and thus the line
  // of questioning that cracks the case — isn't always the same one.
  const cs = supports.length ? supports[Math.floor(rng() * supports.length)] : undefined;
  if (cs) {
    out.push({ id: "L0", kind: "lie", ask: questionLie(cs), answer: claimOf(cs), seg: cs, leverId: cleanBreaker(cs)?.id, patch: patchLine(cs) });
    const t0 = tellFor(cs, rng);
    out.push({ id: "T0", kind: "tell", ask: t0.ask, answer: t0.answer, seg: cs, clash: t0.clash });
  }
  // The SECOND pair varies by seed, so two cases don't play the same: either a
  // second own-words contradiction (another support + its tell) or a record
  // (lever) pair. A second support is needed for the contradiction option.
  const others = supports.filter((s) => s !== cs);
  const cs2 = others.length ? others[Math.floor(rng() * others.length)] : undefined;
  let usedSeg: string | undefined;
  if (cs2 && rng() < 0.45) {
    out.push({ id: "La", kind: "lie", ask: questionLie(cs2), answer: claimOf(cs2), seg: cs2, leverId: cleanBreaker(cs2)?.id, patch: patchLine(cs2) });
    const ta = tellFor(cs2, rng);
    out.push({ id: "Ta", kind: "tell", ask: ta.ask, answer: ta.answer, seg: cs2, clash: ta.clash });
    usedSeg = cs2;
  } else {
    const ls = leverProps.find((p) => p.seg !== cs);
    if (ls) {
      out.push({ id: "L1", kind: "lie", ask: questionLie(ls.seg), answer: claimOf(ls.seg), seg: ls.seg, leverId: ls.lever.id, patch: patchLine(ls.seg) });
      out.push({ id: "V1", kind: "lever", ask: questionLever(ls.seg), answer: leverReaction(ls.seg, rng), evId: ls.lever.id });
      usedSeg = ls.seg;
    }
  }
  // a third prop as a lie with no lever offered, else a dud — to reach five
  const extra = leverProps.find((p) => p.seg !== cs && p.seg !== usedSeg);
  if (out.length < 5 && extra) {
    out.push({ id: "L2", kind: "lie", ask: questionLie(extra.seg), answer: claimOf(extra.seg), seg: extra.seg, leverId: extra.lever.id, patch: patchLine(extra.seg) });
  }

  // In a keystone case, one slot asks who vouches for him — his corroborator,
  // the bluff the whole story rests on. It can't be broken here (no lever, no
  // tell); asking it only plants a suspicion to carry into the confrontation.
  const keystone = web.segments.find((s) => s.keystone);
  if (out.length < 5 && keystone) {
    out.push({ id: "K", kind: "keystone", ask: keystoneQuestion(rng), answer: claimOf(keystone.id), seg: keystone.id });
  }
  // pad to five with duds (distinct); the first names the victim, for weight
  let guard = 0;
  if (out.length < 5 && web.victim) {
    out.push({ id: `D${out.length}`, kind: "dud", ask: "What sort of man was he?", answer: `${web.victim}? Quiet. Kept to himself, paid on time. I'd no quarrel with him.` });
  }
  while (out.length < 5 && guard++ < 20) {
    const d = dudExchange(rng);
    if (out.some((q) => q.ask === d.ask)) continue;
    out.push({ id: `D${out.length}`, kind: "dud", ask: d.ask, answer: d.answer });
  }

  // shuffle so the productive ones aren't always in the same slots
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, 5);
}

export type AskResult = { kind: "lie" | "lever" | "tell" | "dud" | "keystone"; q: Question } | { kind: "none" };
export type PressResult = { kind: "caught"; q: Question; patch: string } | { kind: "blocked" };

export class Interview {
  readonly questions: Question[];
  readonly rounds: number;
  private asked = new Set<string>();
  private held = new Set<string>(); // levers gathered
  private caught = new Set<string>(); // prop segments pre-broken
  private suspected: string | null = null; // the keystone the player has come to doubt
  private roundsUsed = 0;

  constructor(questions: Question[], rounds = ROUNDS) {
    this.questions = questions;
    this.rounds = rounds;
  }

  get roundsLeft(): number {
    return this.rounds - this.roundsUsed;
  }
  get done(): boolean {
    return this.roundsLeft <= 0;
  }
  isAsked(id: string): boolean {
    return this.asked.has(id);
  }
  isCaught(id: string): boolean {
    const q = this.byId(id);
    return !!q?.seg && this.caught.has(q.seg);
  }
  caughtSegments(): string[] {
    return [...this.caught];
  }
  heldLevers(): string[] {
    return [...this.held];
  }
  private byId(id: string): Question | undefined {
    return this.questions.find((q) => q.id === id);
  }

  ask(id: string): AskResult {
    const q = this.byId(id);
    if (!q || this.asked.has(id) || this.done) return { kind: "none" };
    this.asked.add(id);
    this.roundsUsed += 1;
    if (q.kind === "lever" && q.evId) this.held.add(q.evId);
    // asking who vouches for him plants a doubt about that witness — the keystone
    if (q.kind === "keystone" && q.seg) this.suspected = q.seg;
    return { kind: q.kind, q };
  }

  /** The keystone the player has come to doubt (by asking about his witness),
   *  carried into the confrontation as a steer. Null if never raised. */
  suspectedKeystone(): string | null {
    return this.suspected;
  }

  /** A tell he's already given that contradicts this lie's prop (his own words). */
  contradictionFor(lieId: string): Question | undefined {
    const q = this.byId(lieId);
    if (!q || q.kind !== "lie") return undefined;
    return this.questions.find((t) => t.kind === "tell" && this.asked.has(t.id) && t.seg === q.seg);
  }
  /** Every live contradiction the player has surfaced (both answers heard, not yet
   *  spent) — the stored, queryable instability from his own answers. */
  contradictions(): { lie: Question; tell: Question }[] {
    const out: { lie: Question; tell: Question }[] = [];
    for (const lie of this.questions) {
      if (lie.kind !== "lie" || !this.asked.has(lie.id) || this.caught.has(lie.seg!)) continue;
      const tell = this.contradictionFor(lie.id);
      if (tell) out.push({ lie, tell });
    }
    return out;
  }

  /** Can this asked lie be cracked right now — by a held lever OR by a
   *  contradiction between two of his own answers (no external evidence). */
  canPress(id: string): boolean {
    const q = this.byId(id);
    if (!q || q.kind !== "lie" || !this.asked.has(id) || this.caught.has(q.seg!)) return false;
    const byLever = !!q.leverId && this.held.has(q.leverId);
    const byContradiction = !!this.contradictionFor(id);
    return byLever || byContradiction;
  }
  /** How the press would land — for the catch line / cue. */
  pressVia(id: string): "lever" | "contradiction" | null {
    const q = this.byId(id);
    if (!q || q.kind !== "lie") return null;
    if (this.contradictionFor(id)) return "contradiction";
    if (q.leverId && this.held.has(q.leverId)) return "lever";
    return null;
  }

  press(id: string): PressResult {
    const q = this.byId(id);
    if (!q || !this.canPress(id)) return { kind: "blocked" };
    this.caught.add(q.seg!);
    return { kind: "caught", q, patch: q.patch ?? patchLine(q.seg!) };
  }

  /** Hand off to the confrontation: carry the case's starting attack plus every
   *  lever gathered, and arrive with the caught props already toppled. */
  toWeb(web: WebCase, seed: number): WebInquiry {
    const held = [...new Set([...web.startEvidence, ...this.held])];
    return new WebInquiry(web, seed, held, [...this.caught]);
  }
}
