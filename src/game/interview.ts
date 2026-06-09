import { WebCase, WebInquiry, WebEvidence } from "./web";
import { questionLie, questionLever, leverReaction, patchLine, dudExchange } from "./phrasing";

/**
 * The interview (Act 1), the new front half of the game. The detective is given
 * FIVE questions but only THREE rounds — two questions always go unasked, and
 * those gaps become the suspect's cover in the confrontation. Each question is
 * one of:
 *   - a LIE: he tells a propping claim. You can only crack it by holding the
 *     LEVER for it (a fact gathered from a different round), and cracking it
 *     pre-breaks that prop and makes him patch the hole with a fresh lie.
 *   - a LEVER: he lets slip a record that breaks one of his lies — your ammo.
 *   - a DUD: character, no purchase. Spend a round on it and you've wasted it.
 *
 * The web is still generated and verified solvable; the interview only changes
 * what you walk into the confrontation already holding (leads) and already
 * having toppled (caught props). Deterministic.
 */

export type QuestionKind = "lie" | "lever" | "dud";

export interface Question {
  id: string;
  ask: string; // the detective's question
  kind: QuestionKind;
  answer: string; // his immediate reply
  seg?: string; // (lie) the prop segment this claim is
  leverId?: string; // (lie) the evidence that cracks it
  patch?: string; // (lie) what he says when caught
  evId?: string; // (lever) evidence handed to you
}

export const ROUNDS = 3;

/** Derive the five questions from the verified web: lie/lever pairs for the
 *  surface props (never the keystone — that stays the confrontation's payoff),
 *  padded with duds. Deterministic given the rng. */
export function buildQuestions(web: WebCase, rng: () => number): Question[] {
  const cleanBreaker = (segId: string): WebEvidence | undefined =>
    web.evidence.find((e) => e.targets === segId && e.deflectableBy.length === 0);

  // catchable props: non-key, non-keystone, not the dead-end herring, with a clean lever
  const props = web.segments.filter((s) => !s.key && !s.keystone && s.id !== "noise").map((s) => ({ seg: s.id, lever: cleanBreaker(s.id) })).filter((p) => p.lever) as { seg: string; lever: WebEvidence }[];

  const out: Question[] = [];
  // up to two full lie+lever pairs
  const paired = props.slice(0, 2);
  paired.forEach((p, i) => {
    out.push({ id: `L${i}`, kind: "lie", ask: questionLie(p.seg), answer: web.segments.find((s) => s.id === p.seg)!.base, seg: p.seg, leverId: p.lever.id, patch: patchLine(p.seg) });
    out.push({ id: `V${i}`, kind: "lever", ask: questionLever(p.seg), answer: leverReaction(p.seg, rng), evId: p.lever.id });
  });
  // a third prop as a lie with no lever offered (only catchable later), else a dud
  if (props[2]) {
    const p = props[2];
    out.push({ id: "L2", kind: "lie", ask: questionLie(p.seg), answer: web.segments.find((s) => s.id === p.seg)!.base, seg: p.seg, leverId: p.lever.id, patch: patchLine(p.seg) });
  }
  // pad to five with duds (distinct)
  let guard = 0;
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

export type AskResult = { kind: "lie" | "lever" | "dud"; q: Question } | { kind: "none" };
export type PressResult = { kind: "caught"; q: Question; patch: string } | { kind: "blocked" };

export class Interview {
  readonly questions: Question[];
  readonly rounds: number;
  private asked = new Set<string>();
  private held = new Set<string>(); // levers gathered
  private caught = new Set<string>(); // prop segments pre-broken
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
    return { kind: q.kind, q };
  }

  /** Can this asked lie be cracked right now — i.e. do we hold its lever? */
  canPress(id: string): boolean {
    const q = this.byId(id);
    return !!q && q.kind === "lie" && this.asked.has(id) && !!q.leverId && this.held.has(q.leverId) && !this.caught.has(q.seg!);
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
