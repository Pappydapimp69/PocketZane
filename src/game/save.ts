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
