/* =====================================================================
 *  CORE — storage, utilities, LLM call wrapper
 *
 *  Owns: STORAGE_KEY, EMPTY_STATE (v3.2-kernel schema),
 *        loadState/saveState (with v2→v3 forward migration),
 *        callClaude(), JSON parsing helpers.
 *
 *  Fragment — no top-level imports/exports. Concatenated into
 *  artifact/signal.tsx by artifact/build.mjs.
 * ===================================================================== */

const STORAGE_KEY = "signal_zane_v3_kernel";
const LEGACY_STORAGE_KEY = "signal_zane_v2";

const EMPTY_STATE = {
  onboarded: false,
  entries: [],
  prompts: [],
  insights: [],
  corrections: [],
  feedback: {},
  dismissedInsightIds: [],
  savedInsightIds: [],
  zaneState: {
    observeStreakSinceStrike: 99,
    lastStrikeAt: null,
    totalReceiptsShown: 0,
  },
  currentPromptId: null,

  /* v3.2-kernel additions */
  evidenceLog: [],                  // EvidenceLineageLog rows
  scaffoldVocab: {},                // {token: usageCount}
  deflationaryQueue: [],            // [{lineageId, reason, queuedAt}]
  retiredObservationIds: [],
  challengedObservationIds: [],     // surfaced in a challenge already (any session)
  pendingChallenge: null,           // {lineageId, observationValue, observationKind} | null
  promptHistoryMeta: {              // recent prompt class accounting
    recent: [],                     // last 20 {intentClass, at}
    totalPromptCount: 0,
    consecutiveDeflationary: 0,
    lastSynthesisAt: null,
  },
  disclosureLog: {
    lastShapeDisclosureAt: null,    // last time the "I may have helped shape" copy fired
    insightsSinceLastDisclosure: 99,
    challengeSurfacedThisSession: false,
  },
  sessionStartedAt: null,
};

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function migrateLegacyState(legacy) {
  const fresh = clone(EMPTY_STATE);
  return {
    ...fresh,
    ...legacy,
    evidenceLog: fresh.evidenceLog,
    scaffoldVocab: fresh.scaffoldVocab,
    deflationaryQueue: fresh.deflationaryQueue,
    retiredObservationIds: fresh.retiredObservationIds,
    challengedObservationIds: fresh.challengedObservationIds,
    pendingChallenge: null,
    promptHistoryMeta: fresh.promptHistoryMeta,
    disclosureLog: fresh.disclosureLog,
    sessionStartedAt: null,
    zaneState: { ...fresh.zaneState, ...(legacy.zaneState || {}) },
  };
}

function loadState() {
  try {
    if (typeof localStorage === "undefined") return clone(EMPTY_STATE);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...clone(EMPTY_STATE), ...parsed };
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = migrateLegacyState(parsed);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {}
      return migrated;
    }
    return clone(EMPTY_STATE);
  } catch {
    return clone(EMPTY_STATE);
  }
}

function saveState(s) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp01(x) {
  if (typeof x !== "number" || !isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function daysBetween(a, b) {
  return Math.abs(a - b) / (24 * 60 * 60 * 1000);
}

/* =====================================================================
 *  LLM CALL WRAPPER + JSON PARSING
 * ===================================================================== */

async function callClaude(prompt) {
  if (typeof window === "undefined" || !window.claude?.complete) {
    throw new Error(
      "window.claude.complete unavailable — run inside a Claude.ai artifact.",
    );
  }
  return await window.claude.complete(prompt);
}

function stripFences(s) {
  return s
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

function tryParseJson(s) {
  try {
    return JSON.parse(stripFences(s));
  } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}
