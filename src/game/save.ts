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

const CLEAN_KEY = "again:clean";

/** Cases broken "clean" (no strikes, at or under par), by id. */
function cleanSet(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CLEAN_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function isCleanCase(id: string): boolean {
  return !!cleanSet()[id];
}
export function markCleanCase(id: string): void {
  try {
    const o = cleanSet();
    o[id] = true;
    localStorage.setItem(CLEAN_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}
export function getCleanCount(): number {
  return Object.keys(cleanSet()).length;
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

const MOTION_KEY = "again:reduceMotion";

export function getReduceMotion(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === "1";
  } catch {
    return false;
  }
}

export function toggleReduceMotion(): boolean {
  const next = !getReduceMotion();
  try {
    localStorage.setItem(MOTION_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  return next;
}

const DIFF_KEY = "again:difficulty";

/** Strike modifier per difficulty (applied to every case's strike allowance). */
export const DIFFS = [
  { label: "lenient", strikes: 1 },
  { label: "standard", strikes: 0 },
  { label: "relentless", strikes: -1 },
];

export function getDifficulty(): number {
  try {
    const v = parseInt(localStorage.getItem(DIFF_KEY) ?? "1", 10);
    return v >= 0 && v < DIFFS.length ? v : 1;
  } catch {
    return 1;
  }
}

export function cycleDifficulty(): number {
  const next = (getDifficulty() + 1) % DIFFS.length;
  try {
    localStorage.setItem(DIFF_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

const NARR_KEY = "again:narration";

export function getNarration(): boolean {
  try {
    return localStorage.getItem(NARR_KEY) === "1";
  } catch {
    return false;
  }
}

export function toggleNarration(): boolean {
  const next = !getNarration();
  try {
    localStorage.setItem(NARR_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  return next;
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
