/**
 * Tiny persistence. Tracks how many cases have been broken, so the title can
 * show progress and returning play has some memory. localStorage is guarded —
 * private-mode / blocked storage just degrades to a no-op.
 */
const KEY = "again:cleared";

export function getCleared(): number {
  try {
    return parseInt(localStorage.getItem(KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function markCleared(count: number): void {
  try {
    if (count > getCleared()) localStorage.setItem(KEY, String(count));
  } catch {
    /* storage unavailable — ignore */
  }
}

const BEST_KEY = "again:best";

/** Fewest tellings a case has ever been broken in. */
export function getBest(caseId: string): number | null {
  try {
    const o = JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}");
    return typeof o[caseId] === "number" ? o[caseId] : null;
  } catch {
    return null;
  }
}

export function setBest(caseId: string, tellings: number): void {
  try {
    const o = JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}");
    if (o[caseId] == null || tellings < o[caseId]) {
      o[caseId] = tellings;
      localStorage.setItem(BEST_KEY, JSON.stringify(o));
    }
  } catch {
    /* storage unavailable — ignore */
  }
}

const DEEP_KEY = "again:deepest";

/** Furthest night reached in the endless mode. */
export function getDeepest(): number {
  try {
    return parseInt(localStorage.getItem(DEEP_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function markDeepest(night: number): void {
  try {
    if (night > getDeepest()) localStorage.setItem(DEEP_KEY, String(night));
  } catch {
    /* storage unavailable — ignore */
  }
}

const TOTAL_KEY = "again:breaks";

/** Total stories broken, across every mode — drives the detective rank. */
export function getTotalBreaks(): number {
  try {
    return parseInt(localStorage.getItem(TOTAL_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function incBreaks(): void {
  try {
    localStorage.setItem(TOTAL_KEY, String(getTotalBreaks() + 1));
  } catch {
    /* ignore */
  }
}

const RANKS: { at: number; title: string }[] = [
  { at: 0, title: "Rookie" },
  { at: 3, title: "Detective" },
  { at: 8, title: "Inspector" },
  { at: 16, title: "Closer" },
  { at: 30, title: "The Confessor" },
];

export function rankFor(total: number): string {
  let title = RANKS[0].title;
  for (const r of RANKS) if (total >= r.at) title = r.title;
  return title;
}

const INTRO_KEY = "again:seenIntro";

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSeenIntro(): void {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
}
