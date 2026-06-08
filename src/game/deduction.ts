/**
 * Deduction engine (the redesign). A case has a hidden truth; the subject holds
 * a cover story made of THREADS, each a ladder of DEFENSES. You don't watch for
 * random flicker any more — you PRESENT established evidence against a claim,
 * which forces it to rewrite to its next defense (a real alternate explanation),
 * and you QUESTION threads to pull new evidence into your file. Corner the last
 * defense of a thread and it breaks. Break the key threads and the case is solved.
 *
 * Fully deterministic and offline. `weirdness` (0..1) is a flavor dial the future
 * generator will read to bias how strange a case gets; stored on every case now.
 */

export interface Defense {
  /** The sentence shown in the testimony while this defense holds. */
  claim: string;
  /** Evidence ids that contradict this claim and force the next defense (or, on
   * the last rung, break the thread). */
  brokenBy: string[];
}

export interface Thread {
  id: string;
  topic: string; // short label, e.g. "the coat"
  defenses: Defense[];
  /** Key threads must all break to solve the case. */
  key?: boolean;
}

export interface Evidence {
  id: string;
  label: string; // shown in the case file and the picker
}

/** Questioning a thread: a one-shot reply that may hand you new evidence. */
export interface Probe {
  threadId: string;
  reply: string;
  yields: string[]; // evidence ids added to your file
}

export interface Brief {
  what: string;
  where: string;
  when: string;
  why: string;
  goal: string;
}

export interface DCase {
  id: string;
  weirdness: number;
  title: string;
  subject: string;
  brief: Brief;
  threads: Thread[];
  evidence: Evidence[];
  startEvidence: string[];
  probes: Probe[];
  resolution: string;
}

export interface ThreadView {
  id: string;
  topic: string;
  claim: string;
  broken: boolean;
  key: boolean;
}

export type PresentResult =
  | { kind: "forced"; claim: string }
  | { kind: "broke"; key: boolean; solved: boolean }
  | { kind: "nomatch" }
  | { kind: "already" };

export class Inquiry {
  readonly case: DCase;
  private idx = new Map<string, number>();
  private broken = new Set<string>();
  private held = new Set<string>();
  private probed = new Set<string>();
  private used = new Set<string>();

  constructor(c: DCase) {
    this.case = c;
    c.startEvidence.forEach((e) => this.held.add(e));
  }

  threads(): ThreadView[] {
    return this.case.threads.map((t) => ({
      id: t.id,
      topic: t.topic,
      claim: t.defenses[this.idx.get(t.id) ?? 0].claim,
      broken: this.broken.has(t.id),
      key: !!t.key,
    }));
  }

  heldEvidence(): Evidence[] {
    return this.case.evidence.filter((e) => this.held.has(e.id));
  }

  evidenceLabel(id: string): string {
    return this.case.evidence.find((e) => e.id === id)?.label ?? id;
  }

  /** Has this lead ever been successfully presented? (For marking it spent.) */
  isUsed(id: string): boolean {
    return this.used.has(id);
  }

  private keyThreads(): Thread[] {
    return this.case.threads.filter((t) => t.key);
  }
  get total(): number {
    return this.keyThreads().length;
  }
  get brokenCount(): number {
    return this.keyThreads().filter((t) => this.broken.has(t.id)).length;
  }
  get solved(): boolean {
    return this.keyThreads().every((t) => this.broken.has(t.id));
  }

  /** Question a thread. One-shot reveal; re-asking repeats the reply, no new evidence. */
  question(threadId: string): { reply: string; gained: Evidence[] } | null {
    const p = this.case.probes.find((x) => x.threadId === threadId);
    if (!p) return null;
    if (this.probed.has(threadId)) return { reply: p.reply, gained: [] };
    this.probed.add(threadId);
    const gained = p.yields.filter((id) => !this.held.has(id)).map((id) => this.case.evidence.find((e) => e.id === id)!).filter(Boolean);
    p.yields.forEach((id) => this.held.add(id));
    return { reply: p.reply, gained };
  }

  /** Present a held piece of evidence against a thread's current claim. */
  present(threadId: string, evId: string): PresentResult {
    const t = this.case.threads.find((x) => x.id === threadId);
    if (!t) return { kind: "nomatch" };
    if (this.broken.has(threadId)) return { kind: "already" };
    if (!this.held.has(evId)) return { kind: "nomatch" };
    const i = this.idx.get(threadId) ?? 0;
    const def = t.defenses[i];
    if (!def.brokenBy.includes(evId)) return { kind: "nomatch" };
    this.used.add(evId);
    if (i + 1 >= t.defenses.length) {
      this.broken.add(threadId);
      return { kind: "broke", key: !!t.key, solved: this.solved };
    }
    this.idx.set(threadId, i + 1);
    return { kind: "forced", claim: t.defenses[i + 1].claim };
  }
}
