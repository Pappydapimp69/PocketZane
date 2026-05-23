/* =====================================================================
 *  Signal — bundled artifact (DO NOT EDIT BY HAND)
 *
 *  Generated from artifact/src/*.tsx by artifact/build.mjs.
 *  To modify Signal, edit the fragment files under artifact/src/ and
 *  re-run: node artifact/build.mjs
 *
 *  This is the file you paste into a Claude.ai artifact.
 * ===================================================================== */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Save,
  ChevronLeft,
  Loader2,
  Pencil,
  Send,
  Eye,
} from "lucide-react";


/* ====================================================================
 * BUNDLED FROM: src/01-core.tsx
 * ==================================================================== */
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

/* ====================================================================
 * BUNDLED FROM: src/02-voice.tsx
 * ==================================================================== */
/* =====================================================================
 *  VOICE — Zane's persona constants + seed prompts + epistemic axes
 *
 *  Voice axis (density):     SHARP | SPARSE | NEUTRAL | CURIOUS
 *  Epistemic axis (intent):  OPEN | POINTED | PIVOT | CALLBACK |
 *                            DEFLATIONARY | SYNTHESIS
 *  Per-observation axis (sourceMode): free | prompt | callback
 *
 *  Density and intentClass are orthogonal. Density controls how a
 *  prompt sounds; intentClass controls what it does to the evidence.
 *
 *  Fragment.
 * ===================================================================== */

const ANTI_CLEVERNESS = `
HARD VOICE CONSTRAINTS (violating any of these = bad output):
- NEVER use these words: profound, journey, authentic, vulnerable, raw, healing, growth, soul, abyss, void, shadow, entropy, darkness, weight (figurative), walls (figurative), cages, chains, lens, mirror, dance, navigate, hold space, sit with.
- NEVER use therapy cadence: no "how does that make you feel", no "what comes up", no "I'm hearing that", no "it sounds like you're", no "honor that".
- NEVER use aphorisms or maxim-shaped sentences. No life-advice tone.
- NEVER say "you are someone who" / "you are the kind of person who".
- Max ONE figurative phrase per utterance. Default to zero.
- Declarative voice when naming a feeling or motive. Not "you may be angry" — "you sound angry."
- Best lines feel accidentally incisive. Polish reads as performance. Don't perform.
- If the line could be screenshotted as a quote-card, it's too written. Rewrite plainer.
- A perceptive friend who hates posturing wouldn't send it? Don't send it.
- Variance matters: sparse and neutral are fine. Don't be incisive every time.
`;

const ZANE_EXEMPLARS = `
GOOD voice (model your output on these):
- "You spent four sentences on what he did, half a sentence on why it bothered you. Try it the other way."
- "Convenient phrasing."
- "That sentence flinched."
- "You skipped the center again."
- "You keep pretending this was your idea."
- "Noted. You used 'just' nine times."
- "Tell me the version you'd give the person you trust least."
- "You sound angry."
- "Interesting. You become ambitious immediately after feeling socially insignificant."

BAD voice (do NOT produce anything like these):
- "Your soul bends toward entropy."
- "How does that make you feel?"
- "I'm hearing that you're struggling."
- "What a powerful insight about your journey."
- "Healing is not linear."
- "Sit with that for a moment."
- "You are someone who craves connection."
- "It seems like you might be feeling overwhelmed."
`;

/* Intent classes. SourceMode is a separate axis on observations. */
const INTENT_CLASSES = [
  "OPEN",
  "POINTED",
  "PIVOT",
  "CALLBACK",
  "DEFLATIONARY",
  "SYNTHESIS",
];

/* Pressure defaults per intent class. Values in [0,1].
 * - pressureScore: how much the prompt pushes for a particular kind of answer
 * - interpretiveDepth: how much it asks the user to model themselves
 * - emotionalLeadingRisk: how likely it is to put a feeling in the user's mouth
 * Observations elicited by high-pressure prompts inherit higher inductionRisk. */
const PRESSURE_DEFAULTS = {
  OPEN:         { pressureScore: 0.2, interpretiveDepth: 0.2, emotionalLeadingRisk: 0.2 },
  POINTED:      { pressureScore: 0.75, interpretiveDepth: 0.7, emotionalLeadingRisk: 0.5 },
  PIVOT:        { pressureScore: 0.45, interpretiveDepth: 0.6, emotionalLeadingRisk: 0.25 },
  CALLBACK:     { pressureScore: 0.5, interpretiveDepth: 0.7, emotionalLeadingRisk: 0.45 },
  DEFLATIONARY: { pressureScore: 0.7, interpretiveDepth: 0.8, emotionalLeadingRisk: 0.1 },
  SYNTHESIS:    { pressureScore: 0.25, interpretiveDepth: 0.5, emotionalLeadingRisk: 0.2 },
};

function pressureFor(intentClass) {
  return PRESSURE_DEFAULTS[intentClass] || PRESSURE_DEFAULTS.OPEN;
}

/* Seed prompts — used until the user has enough history for Claude-generated.
 * Each has BOTH density (voice axis) and intentClass (epistemic axis).
 * Seeds are OPEN or POINTED only — CALLBACK/DEFLATIONARY/SYNTHESIS need history. */
const SEED_PROMPTS = [
  { density: "NEUTRAL", intentClass: "OPEN",    text: "What's the last thing today that took up more headspace than it deserved?" },
  { density: "SHARP",   intentClass: "POINTED", text: "Tell me about something today you'd narrate differently to different people. Pick the version you'd give the one you trust least." },
  { density: "SPARSE",  intentClass: "POINTED", text: "What did you avoid?" },
  { density: "NEUTRAL", intentClass: "OPEN",    text: "Describe one conversation from today in three sentences." },
  { density: "SHARP",   intentClass: "POINTED", text: "What did you do today that you'd be embarrassed to journal honestly about?" },
  { density: "CURIOUS", intentClass: "OPEN",    text: "What's a small thing someone said this week that's still rattling around?" },
  { density: "SPARSE",  intentClass: "OPEN",    text: "Where did today drag?" },
  { density: "SHARP",   intentClass: "POINTED", text: "What's a feeling you've been calling by the wrong name?" },
  { density: "NEUTRAL", intentClass: "POINTED", text: "What did you want today that you didn't ask for?" },
  { density: "SPARSE",  intentClass: "POINTED", text: "What flinched today?" },
  { density: "CURIOUS", intentClass: "OPEN",    text: "What's a small decision today that felt larger than it should have?" },
  { density: "SHARP",   intentClass: "OPEN",    text: "Pick something you were certain about a year ago and now aren't." },
  { density: "NEUTRAL", intentClass: "OPEN",    text: "What's one thing you postponed today?" },
  { density: "SPARSE",  intentClass: "POINTED", text: "Who did you perform for?" },
  { density: "SHARP",   intentClass: "POINTED", text: "What's the laziest sentence you used today and what was it covering for?" },
  { density: "NEUTRAL", intentClass: "OPEN",    text: "Describe the last time today you felt fully present." },
  { density: "CURIOUS", intentClass: "OPEN",    text: "What made you laugh? Really laugh, not the social one." },
  { density: "SPARSE",  intentClass: "OPEN",    text: "What did you reread?" },
  { density: "SHARP",   intentClass: "POINTED", text: "What's a story you tell about yourself that's getting harder to believe?" },
  { density: "NEUTRAL", intentClass: "OPEN",    text: "What happened today that you'd want a future version of you to remember?" },
  { density: "SPARSE",  intentClass: "POINTED", text: "What sentence wouldn't you say out loud?" },
  { density: "CURIOUS", intentClass: "POINTED", text: "What's a small piece of evidence today against something you assume about yourself?" },
  { density: "SHARP",   intentClass: "POINTED", text: "What did you call a choice that was actually a reflex?" },
  { density: "NEUTRAL", intentClass: "OPEN",    text: "Who took up the most room in your head today?" },
  { density: "SPARSE",  intentClass: "OPEN",    text: "What surprised you?" },
  { density: "SHARP",   intentClass: "POINTED", text: "What did you do today purely so you could tell someone about it later?" },
  { density: "CURIOUS", intentClass: "OPEN",    text: "What's a feeling today you don't have a good word for?" },
  { density: "NEUTRAL", intentClass: "OPEN",    text: "What did you start? What did you finish?" },
  { density: "SPARSE",  intentClass: "POINTED", text: "What sounded rehearsed?" },
  { density: "SHARP",   intentClass: "POINTED", text: "What did you protect today that maybe didn't need protecting?" },
];

/* Scaffold vocabulary — light. Words common in the scaffold's own copy.
 * Used to detect lexical adoption in user free-writes.
 * Built up dynamically from generated prompts via captureScaffoldTokens(). */
const STOPWORDS = new Set([
  "the","a","an","of","to","and","in","on","is","it","that","this","you","your",
  "for","with","at","by","be","are","was","were","i","he","she","we","they",
  "but","or","not","do","did","does","what","who","when","where","why","how",
  "if","then","than","so","as","just","like","one","two","three","four","five",
  "today","yesterday","tomorrow","now","my","me","yours","its","there","here",
  "have","has","had","get","got","had","go","goes","went","make","makes",
  "thing","things","time","day","week","year","month","again","more","less",
  "very","really","much","some","any","all","every","most","other","another",
  "would","could","should","will","can","may","might","must",
]);

function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function captureScaffoldTokens(scaffoldVocab, text) {
  const next = { ...scaffoldVocab };
  for (const tok of tokenize(text)) {
    next[tok] = (next[tok] || 0) + 1;
  }
  return next;
}

function scaffoldOverlap(scaffoldVocab, text) {
  const toks = tokenize(text);
  if (toks.length === 0) return 0;
  let hits = 0;
  for (const t of toks) if (scaffoldVocab[t]) hits++;
  return hits / toks.length;
}

/* ====================================================================
 * BUNDLED FROM: src/03-lineage.tsx
 * ==================================================================== */
/* =====================================================================
 *  LINEAGE — EvidenceLineageLog operations
 *
 *  Each observation row:
 *    id, kind, value, entryId, sourceMode, intentClass,
 *    firstSeenAt, lastSeenAt, occurrenceCount,
 *    intentDiversity: [intentClass, ...],
 *    sourceEntries: [{entryId, sourceMode, intentClass, at}, ...]  (light)
 *    patternConfidence, attributionConfidence,
 *    inductionRisk, independenceScore,
 *    confidenceState
 *
 *  Operations:
 *    extractionToObservations(extraction)        — flatten extraction
 *    upsertObservations(log, observations, ctx)  — merge into log
 *
 *  Fragment.
 * ===================================================================== */

const INITIAL_CONFIDENCE_STATE = "induced";

function normalizeValue(s) {
  return String(s || "").trim().toLowerCase();
}

function extractionToObservations(extraction) {
  const out = [];
  for (const t of extraction.themes || []) {
    const v = normalizeValue(t);
    if (v) out.push({ kind: "theme", value: v });
  }
  for (const e of extraction.entities || []) {
    const v = normalizeValue(e.name);
    if (v) out.push({ kind: "entity", value: v, meta: { entityType: e.type } });
  }
  for (const em of extraction.emotions || []) {
    const v = normalizeValue(em.label);
    if (v) out.push({ kind: "emotion", value: v, meta: { intensity: em.intensity } });
  }
  for (const b of extraction.behaviors || []) {
    const v = normalizeValue(b);
    if (v) out.push({ kind: "behavior", value: v });
  }
  for (const p of extraction.verbatim_phrases || []) {
    const v = normalizeValue(p);
    if (v) out.push({ kind: "phrase", value: v });
  }
  return out;
}

/* Upsert observations into the lineage log.
 * ctx: { entryId, sourceMode, intentClass, at }
 * Returns: { nextLog, touchedIds }
 */
function upsertObservations(log, observations, ctx) {
  const next = log.slice();
  const touchedIds = [];
  for (const obs of observations) {
    const existing = next.find((o) => o.kind === obs.kind && o.value === obs.value);
    if (existing) {
      existing.lastSeenAt = ctx.at;
      existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      if (!existing.intentDiversity.includes(ctx.intentClass)) {
        existing.intentDiversity = [...existing.intentDiversity, ctx.intentClass];
      }
      existing.sourceEntries = [
        ...(existing.sourceEntries || []),
        {
          entryId: ctx.entryId,
          sourceMode: ctx.sourceMode,
          intentClass: ctx.intentClass,
          at: ctx.at,
        },
      ].slice(-30);                              // cap memory
      touchedIds.push(existing.id);
    } else {
      const row = {
        id: newId(),
        kind: obs.kind,
        value: obs.value,
        entryId: ctx.entryId,
        sourceMode: ctx.sourceMode,
        intentClass: ctx.intentClass,
        firstSeenAt: ctx.at,
        lastSeenAt: ctx.at,
        occurrenceCount: 1,
        intentDiversity: [ctx.intentClass],
        sourceEntries: [{
          entryId: ctx.entryId,
          sourceMode: ctx.sourceMode,
          intentClass: ctx.intentClass,
          at: ctx.at,
        }],
        patternConfidence: 0.3,
        attributionConfidence: 0.3,
        inductionRisk: 0.5,
        independenceScore: 0.0,
        confidenceState: INITIAL_CONFIDENCE_STATE,
        meta: obs.meta || {},
      };
      next.push(row);
      touchedIds.push(row.id);
    }
  }
  return { nextLog: next, touchedIds };
}

/* Find scaffold-dormancy for a pattern: days since the last
 * prompt-elicited occurrence of this observation. Used by
 * confidence-state transitions. */
function scaffoldDormancyDays(observation, now) {
  if (!observation.sourceEntries) return 999;
  const lastPrompted = observation.sourceEntries
    .filter((s) => s.sourceMode !== "free")
    .map((s) => s.at)
    .sort((a, b) => b - a)[0];
  if (!lastPrompted) return 999;                 // never prompted
  return daysBetween(now, lastPrompted);
}

function hasFreeWriteOccurrence(observation) {
  return (observation.sourceEntries || []).some((s) => s.sourceMode === "free");
}

function lastOccurrenceMode(observation) {
  const list = (observation.sourceEntries || []).slice().sort((a, b) => b.at - a.at);
  return list[0]?.sourceMode || "prompt";
}

/* ====================================================================
 * BUNDLED FROM: src/04-provenance.tsx
 * ==================================================================== */
/* =====================================================================
 *  PROVENANCE — confidence scoring + state machine + event deflation
 *
 *  Owns: independenceScore, inductionRisk, patternConfidence,
 *        attributionConfidence, confidenceState transitions,
 *        retire / contradict / endorse event handlers.
 *
 *  Continuous statistical decay by kind is deferred to v3.3.
 *
 *  Fragment.
 * ===================================================================== */

function intentEntropyNormalized(intentDiversity) {
  /* Normalized entropy in [0,1] over the set of intent classes seen.
   * Single class → 0. Two equal-frequency classes → ~0.5+ depending
   * on the universe. We approximate by treating each distinct class
   * as one observation. */
  const n = intentDiversity.length;
  if (n <= 1) return 0;
  const max = Math.log(INTENT_CLASSES.length);
  return Math.min(1, Math.log(n) / max);
}

function meanEliciatingPressure(observation, _prompts) {
  /* Pressure is recorded per intentClass via PRESSURE_DEFAULTS. We average
   * across the recorded sourceEntries. (Per-prompt overrides land in v3.3.) */
  const fallbacks = (observation.sourceEntries || [])
    .filter((s) => s.sourceMode !== "free")
    .map((s) => pressureFor(s.intentClass).pressureScore);
  if (fallbacks.length === 0) return 0.5;
  return fallbacks.reduce((a, b) => a + b, 0) / fallbacks.length;
}

function temporalSpreadDays(observation) {
  return daysBetween(observation.lastSeenAt, observation.firstSeenAt);
}

function userInitiatedReappearance(observation) {
  /* True if the observation has been seen in a free-write after a ≥7-day
   * gap from any prior prompt-elicited occurrence. */
  const sorted = (observation.sourceEntries || []).slice().sort((a, b) => a.at - b.at);
  let lastPromptAt = null;
  for (const s of sorted) {
    if (s.sourceMode === "free" && lastPromptAt && daysBetween(s.at, lastPromptAt) >= 7) {
      return true;
    }
    if (s.sourceMode !== "free") lastPromptAt = s.at;
  }
  return false;
}

function computeIndependenceScore(observation) {
  let score = 0;
  if (hasFreeWriteOccurrence(observation))            score += 0.25;
  if (observation.intentDiversity.length >= 2)        score += 0.25;
  if (temporalSpreadDays(observation) > 7)            score += 0.25;
  if (userInitiatedReappearance(observation))         score += 0.15;
  if ((observation.scaffoldOverlap ?? 0.5) < 0.3)     score += 0.10;
  return clamp01(score);
}

function computeInductionRisk(observation, prompts) {
  let risk = 0.5;
  const sources = observation.sourceEntries || [];
  const freeFraction =
    sources.length === 0
      ? 0
      : sources.filter((s) => s.sourceMode === "free").length / sources.length;
  const promptFraction = 1 - freeFraction;

  if (freeFraction === 0)                              risk += 0.25;
  if (meanEliciatingPressure(observation, prompts) >= 0.6) risk += 0.15;
  if (observation.intentDiversity.length === 1)        risk += 0.20;
  if ((observation.scaffoldOverlap ?? 0) >= 0.4)       risk += 0.10;

  if (freeFraction >= 0.25)                            risk -= 0.20;
  if (observation.intentDiversity.length >= 3)         risk -= 0.20;
  if (temporalSpreadDays(observation) > 14)            risk -= 0.10;
  if (userInitiatedReappearance(observation))          risk -= 0.20;

  /* DEFLATIONARY occurrences are not contamination; they're audits.
   * Don't penalize a pattern for appearing in DEFLATIONARY context. */
  if (observation.intentDiversity.includes("DEFLATIONARY")) risk -= 0.05;

  return clamp01(risk);
}

function computePatternConfidence(observation) {
  const n = observation.occurrenceCount || 1;
  let base;
  if (n === 1)      base = 0.30;
  else if (n === 2) base = 0.50;
  else if (n === 3) base = 0.65;
  else              base = clamp01(0.65 + Math.min(0.30, 0.05 * (n - 3)));

  if (observation.confidenceState === "user-endorsed")        base += 0.10;
  if (observation.confidenceState === "integrated")           base += 0.15;
  if (observation.confidenceState === "convergence-validated") base += 0.05;
  if (observation.confidenceState === "user-retained")        base += 0.03;
  if (observation.confidenceState === "retired")              base = 0.05;

  return clamp01(base);
}

function computeAttributionConfidence(observation, prompts) {
  const risk = computeInductionRisk(observation, prompts);
  const evidenceFactor = Math.min(1, (observation.occurrenceCount || 1) / 3);
  return clamp01((1 - risk) * evidenceFactor);
}

/* Recompute all four scores for a single observation and write back. */
function rescoreObservation(observation, prompts, scaffoldVocab) {
  observation.scaffoldOverlap = scaffoldOverlap(scaffoldVocab, observation.value);
  observation.independenceScore = computeIndependenceScore(observation);
  observation.inductionRisk = computeInductionRisk(observation, prompts);
  observation.patternConfidence = computePatternConfidence(observation);
  observation.attributionConfidence = computeAttributionConfidence(observation, prompts);
  return observation;
}

function rescoreObservations(log, ids, prompts, scaffoldVocab) {
  return log.map((o) =>
    ids.includes(o.id) ? rescoreObservation({ ...o }, prompts, scaffoldVocab) : o,
  );
}

/* =====================================================================
 *  CONFIDENCE STATE TRANSITIONS
 * ===================================================================== */

function nextConfidenceState(observation, now) {
  const current = observation.confidenceState || INITIAL_CONFIDENCE_STATE;
  if (current === "retired") return "retired";

  const dormancy = scaffoldDormancyDays(observation, now);
  const hasFree = hasFreeWriteOccurrence(observation);
  const intents = observation.intentDiversity.length;
  const independence = observation.independenceScore ?? 0;

  /* INTEGRATED — fully self-sustaining */
  if (hasFree && intents >= 2 && dormancy >= 7) return "integrated";
  if (current === "user-endorsed" && independence >= 0.4 && userInitiatedReappearance(observation)) {
    return "integrated";
  }

  /* PROVENANCE-CLEARED — free-write after a real scaffold gap */
  if (hasFree && lastOccurrenceMode(observation) === "free" && dormancy >= 7) {
    if (current === "induced" || current === "user-retained") return "provenance-cleared";
  }

  /* CONVERGENCE-VALIDATED — diversity across intent classes */
  if (intents >= 2 && current === "induced") return "convergence-validated";

  return current;
}

function applyStateTransitions(log, ids, now) {
  return log.map((o) => {
    if (!ids.includes(o.id)) return o;
    const ns = nextConfidenceState(o, now);
    return ns === o.confidenceState ? o : { ...o, confidenceState: ns };
  });
}

/* =====================================================================
 *  EVENT-TRIGGERED DEFLATION (continuous decay → v3.3)
 * ===================================================================== */

function retireObservationInLog(log, lineageId) {
  return log.map((o) =>
    o.id === lineageId
      ? {
          ...o,
          confidenceState: "retired",
          patternConfidence: 0.05,
          attributionConfidence: 0.05,
        }
      : o,
  );
}

function endorseObservationInLog(log, lineageId, now) {
  return log.map((o) => {
    if (o.id !== lineageId) return o;
    const next = {
      ...o,
      confidenceState:
        o.confidenceState === "retired" ? "user-retained" : "user-endorsed",
    };
    next.patternConfidence = clamp01((o.patternConfidence || 0) + 0.10);
    return next;
  });
}

function contradictObservationsInLog(log, lineageIds, cutFactor = 0.3) {
  return log.map((o) => {
    if (!lineageIds.includes(o.id)) return o;
    return {
      ...o,
      patternConfidence: clamp01((o.patternConfidence || 0) * (1 - cutFactor)),
      attributionConfidence: clamp01((o.attributionConfidence || 0) * (1 - cutFactor)),
    };
  });
}

/* ====================================================================
 * BUNDLED FROM: src/05-disclosure.tsx
 * ==================================================================== */
/* =====================================================================
 *  DISCLOSURE + COMPOSITION RULE + STATE ENGINE
 *
 *  - Composition rule (patternConfidence × inductionRisk → action)
 *  - Insight routing (emit | emit-with-provenance | DEFLATIONARY queue | suppress)
 *  - Disclosure policy: silent by default, rate-limited copy
 *  - OBSERVE / INTERPRET / STRIKE state engine
 *  - findDormantCallback (resurfacing engine)
 *
 *  Hard invariants (over-analysis protection):
 *    - ≤ 1 provenance line per 4 insights
 *    - "I may have helped shape this" ≤ 1 per 7 days
 *    - ≤ 1 provenance challenge surfaced per session
 *    - DEFLATIONARY rate: floor ≥1 per 20, ceiling ≤1 per 4
 *
 *  Fragment.
 * ===================================================================== */

const COMPOSITION_ACTIONS = {
  STANDARD: "standard",
  WITH_PROVENANCE: "with-provenance",
  DEFLATIONARY_QUEUE: "deflationary-queue",
  SUPPRESS: "suppress",
  WATCHLIST: "watchlist",
};

const SHAPE_DISCLOSURE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const DISCLOSURE_COPY = {
  mild: "Seen across {n} entries. Some came from my prompting.",
  medium: "Mostly emerged through my questions. Read accordingly.",
  shape: "I may have helped shape this.",
};

/* Composition rule. Operates on aggregate confidence/risk over the
 * observations supporting an insight. */
function routeInsight(observationsAggregate) {
  const { confidence, risk, risingIndependence } = observationsAggregate;
  if (confidence >= 0.7 && risk < 0.3) return COMPOSITION_ACTIONS.STANDARD;
  if (confidence >= 0.7 && risk <= 0.6) return COMPOSITION_ACTIONS.WITH_PROVENANCE;
  if (confidence >= 0.7 && risk > 0.6) return COMPOSITION_ACTIONS.DEFLATIONARY_QUEUE;
  if (confidence < 0.5 && risk > 0.6) return COMPOSITION_ACTIONS.SUPPRESS;
  if (confidence >= 0.5 && confidence < 0.7 && risingIndependence) {
    return COMPOSITION_ACTIONS.WATCHLIST;
  }
  return COMPOSITION_ACTIONS.STANDARD;
}

/* Given an insight + the log, find the supporting observations
 * and aggregate. Supporting = observations whose sourceEntries
 * intersect the insight's evidence_entry_ids. */
function supportingObservations(insight, log) {
  const eids = new Set(insight.evidence_entry_ids || []);
  return log.filter((o) =>
    (o.sourceEntries || []).some((s) => eids.has(s.entryId)),
  );
}

function aggregateForRouting(supporting) {
  if (supporting.length === 0) {
    return { confidence: 0, risk: 0.5, risingIndependence: false };
  }
  const confidence =
    supporting.reduce((a, o) => a + (o.patternConfidence || 0), 0) / supporting.length;
  const risk =
    supporting.reduce((a, o) => a + (o.inductionRisk || 0), 0) / supporting.length;
  /* Heuristic: rising independence if any supporting observation is
   * provenance-cleared or convergence-validated or user-endorsed. */
  const risingIndependence = supporting.some((o) =>
    ["provenance-cleared", "convergence-validated", "user-endorsed", "integrated"].includes(o.confidenceState),
  );
  return { confidence, risk, risingIndependence };
}

/* =====================================================================
 *  DISCLOSURE POLICY (rate-limited surfacing)
 * ===================================================================== */

function canShowProvenanceLine(disclosureLog, action) {
  if (action !== COMPOSITION_ACTIONS.WITH_PROVENANCE) return false;
  /* ≤ 1 disclosure per 4 insights — track via insightsSinceLastDisclosure */
  if ((disclosureLog.insightsSinceLastDisclosure ?? 99) < 4) return false;
  return true;
}

function canShowShapeCopy(disclosureLog, now) {
  const last = disclosureLog.lastShapeDisclosureAt;
  if (!last) return true;
  return now - last >= SHAPE_DISCLOSURE_COOLDOWN_MS;
}

/* Pick disclosure copy variant. severity 0-1 based on inductionRisk. */
function pickDisclosureCopy(supporting, risk, disclosureLog, now) {
  const n = new Set(supporting.flatMap((o) =>
    (o.sourceEntries || []).map((s) => s.entryId),
  )).size;
  if (risk > 0.55 && canShowShapeCopy(disclosureLog, now)) {
    return { variant: "shape", text: DISCLOSURE_COPY.shape };
  }
  if (risk >= 0.4) {
    return { variant: "medium", text: DISCLOSURE_COPY.medium };
  }
  return { variant: "mild", text: DISCLOSURE_COPY.mild.replace("{n}", String(n)) };
}

function canSurfaceChallenge(disclosureLog) {
  return !disclosureLog.challengeSurfacedThisSession;
}

/* =====================================================================
 *  DEFLATIONARY RATE GOVERNANCE
 *
 *  recent = last 20 prompts {intentClass}.
 *  ceiling: deflationary count ≤ 5 (= 25%).
 *  floor:   if last 20 prompts include zero DEFLATIONARY, force one.
 *
 *  forceSynthesis: 3 consecutive DEFLATIONARY in last 10 → next is SYNTHESIS.
 * ===================================================================== */

const RECENT_WINDOW = 20;
const DEFLATIONARY_CEILING = 5;
const DEFLATIONARY_FLOOR_GAP = 20;

function countByClass(recent, cls) {
  return recent.filter((p) => p.intentClass === cls).length;
}

function deflationaryCeilingHit(recent) {
  return countByClass(recent.slice(-RECENT_WINDOW), "DEFLATIONARY") >= DEFLATIONARY_CEILING;
}

function deflationaryFloorDue(recent) {
  if (recent.length < DEFLATIONARY_FLOOR_GAP) return false;
  return countByClass(recent.slice(-DEFLATIONARY_FLOOR_GAP), "DEFLATIONARY") === 0;
}

function shouldForceSynthesis(recent, lastSynthesisAt, now) {
  /* 3 consecutive DEFLATIONARY in last 10 prompts → force SYNTHESIS next */
  const last10 = recent.slice(-10);
  let streak = 0;
  for (let i = last10.length - 1; i >= 0; i--) {
    if (last10[i].intentClass === "DEFLATIONARY") streak++;
    else break;
  }
  if (streak >= 3) return true;
  /* If we've had many DEFLATIONARY in a stretch and no SYNTHESIS in 14d, suggest */
  const lastSyn = lastSynthesisAt || 0;
  if (countByClass(last10, "DEFLATIONARY") >= 4 && now - lastSyn > 7 * 24 * 60 * 60 * 1000) {
    return true;
  }
  return false;
}

/* =====================================================================
 *  STATE ENGINE — OBSERVE / INTERPRET / STRIKE (carried from v2)
 * ===================================================================== */

function selectZaneState(state) {
  const z = state.zaneState;
  const totalEntries = state.entries.length;

  if (totalEntries < 3) {
    return Math.random() < 0.6 ? "OBSERVE" : "INTERPRET";
  }
  const cooldown = z.observeStreakSinceStrike < 3;
  if (cooldown) {
    return Math.random() < 0.7 ? "OBSERVE" : "INTERPRET";
  }
  const r = Math.random();
  if (r < 0.55) return "OBSERVE";
  if (r < 0.88) return "INTERPRET";
  return "STRIKE";
}

function findDormantCallback(entries) {
  if (entries.length < 8) return null;
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => now - e.createdAt <= (3 * WEEK) / 7); // last ~3 days
  const dormant = entries.filter((e) => now - e.createdAt >= WEEK);
  if (recent.length === 0 || dormant.length === 0) return null;

  const themeOverlap = (a, b) => {
    const A = new Set((a.extraction?.themes || []).map((t) => t.toLowerCase()));
    const B = new Set((b.extraction?.themes || []).map((t) => t.toLowerCase()));
    let n = 0;
    for (const t of A) if (B.has(t)) n++;
    return n;
  };
  const entityOverlap = (a, b) => {
    const A = new Set((a.extraction?.entities || []).map((e) => e.name.toLowerCase()));
    const B = new Set((b.extraction?.entities || []).map((e) => e.name.toLowerCase()));
    let n = 0;
    for (const t of A) if (B.has(t)) n++;
    return n;
  };

  let best = null;
  for (const r of recent) {
    for (const d of dormant) {
      const score = themeOverlap(r, d) * 2 + entityOverlap(r, d);
      if (score > 0 && (!best || score > best.score)) {
        best = { recent: r, dormant: d, score };
      }
    }
  }
  return best;
}

/* =====================================================================
 *  DEFLATIONARY TARGETING — highest-RISK pattern, not highest-confidence
 * ===================================================================== */

function pruneDeflationaryQueue(queue, log) {
  /* Drop queue entries pointing to retired or missing observations. */
  return queue.filter((q) => {
    const obs = log.find((o) => o.id === q.lineageId);
    return obs && obs.confidenceState !== "retired";
  });
}

function pickDeflationaryTarget(log, queue, retiredIds, challengedIds) {
  /* Prefer items already in the queue (insight-driven). */
  const cleanQueue = pruneDeflationaryQueue(queue, log);
  if (cleanQueue.length > 0) {
    const head = cleanQueue[0];
    const obs = log.find((o) => o.id === head.lineageId);
    if (obs) {
      return { observation: obs, reason: head.reason || "insight-deferred", consumedQueueHead: true };
    }
  }
  /* Else: score = inductionRisk × patternConfidence × intent-monoculture × occurrence weight */
  const candidates = log.filter((o) =>
    o.confidenceState !== "retired" &&
    !retiredIds.includes(o.id) &&
    o.occurrenceCount >= 2,
  );
  if (candidates.length === 0) return null;
  const scored = candidates.map((o) => {
    const monoculture = o.intentDiversity.length === 1 ? 1 : 0;
    const occW = Math.min(1, (o.occurrenceCount || 0) / 5);
    const fresh = challengedIds.includes(o.id) ? 0.3 : 1;   // dial back if already challenged
    const score =
      (o.inductionRisk || 0) * 0.45 +
      (o.patternConfidence || 0) * 0.20 +
      monoculture * 0.20 +
      occW * 0.15;
    return { obs: o, score: score * fresh };
  });
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score < 0.35) return null;
  return { observation: scored[0].obs, reason: "highest-risk", consumedQueueHead: false };
}

/* ====================================================================
 * BUNDLED FROM: src/06-llm.tsx
 * ==================================================================== */
/* =====================================================================
 *  LLM — all generation functions
 *
 *  extractEntry, generateReceipt, maybeGenerateInsight,
 *  generateNextPrompt (intent-class aware),
 *  generateCallbackPrompt,
 *  generateDeflationaryPrompt,
 *  generateSynthesisPrompt.
 *
 *  Every generator returns null on parse failure; callers handle.
 *
 *  Fragment.
 * ===================================================================== */

async function extractEntry(text) {
  const prompt = `Extract structured meaning from a journal fragment. Return ONLY JSON:
{
  "summary": "one neutral sentence",
  "entities": [{"name": "string", "type": "PERSON|PLACE|PROJECT|CONCEPT"}],
  "emotions": [{"label": "string", "intensity": 1}],
  "themes": ["string"],
  "behaviors": ["string"],
  "verbatim_phrases": ["distinctive phrases worth tracking, max 3"]
}

Rules:
- intensity is integer 1..5.
- Canonicalize names ("the gym" -> "gym").
- verbatim_phrases captures repeated wording, hedges, idioms, or word choices that might recur across entries.

Entry:
"""${text}"""

JSON:`;
  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p) throw new Error("extraction unparseable");
  return {
    summary: String(p.summary || ""),
    entities: Array.isArray(p.entities) ? p.entities : [],
    emotions: Array.isArray(p.emotions) ? p.emotions : [],
    themes: Array.isArray(p.themes) ? p.themes : [],
    behaviors: Array.isArray(p.behaviors) ? p.behaviors : [],
    verbatim_phrases: Array.isArray(p.verbatim_phrases) ? p.verbatim_phrases : [],
  };
}

async function generateReceipt(entry, corrections) {
  const correctionsBlock = corrections.length
    ? `\nThe user has corrected your prior interpretations. Treat these as ground truth:\n${corrections
        .slice(-8)
        .map((c) => `- You said "${c.originalText}" — they corrected to "${c.userText}"`)
        .join("\n")}`
    : "";

  const prompt = `You are Zane. The user just wrote a single journal entry. Output ONE short utterance (usually 1 sentence, occasionally 2, sometimes 2-4 words) that responds to THIS entry only.

What good output looks like:
- Names a specific word or phrase they kept using or skipped
- Points at a tonal shift mid-sentence
- A 2-4 word remark like "Convenient phrasing." or "That sentence flinched."
- A specific observation about THIS entry, not patterns across time

What this is NOT:
- Cross-entry pattern claims — you don't have permission for those right now
- Advice or feeling-check questions
- Anything generic that would apply to any entry

If your utterance names an emotion, motive, or interpretation about the user, set "hasInterpretation": true. That gives the user a one-tap correction affordance.

Max one figurative phrase per utterance.

${ANTI_CLEVERNESS}
${ZANE_EXEMPLARS}
${correctionsBlock}

Entry: """${entry.text}"""

Return JSON only:
{"text": "...", "hasInterpretation": true|false}`;

  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p || !p.text) return null;
  return {
    text: String(p.text).slice(0, 400),
    hasInterpretation: Boolean(p.hasInterpretation),
  };
}

async function maybeGenerateInsight(entries, existingInsights, dismissedIds, corrections) {
  if (entries.length < 3) return null;
  const recent = entries.slice(-25);
  const indexed = recent
    .map((e, i) => {
      const ex = e.extraction || {};
      return `[${i}] ${new Date(e.createdAt).toLocaleString()}
  text: ${e.text}
  themes: ${(ex.themes || []).join(", ") || "—"}
  emotions: ${(ex.emotions || []).map((em) => `${em.label}(${em.intensity})`).join(", ") || "—"}
  entities: ${(ex.entities || []).map((en) => en.name).join(", ") || "—"}
  phrases: ${(ex.verbatim_phrases || []).join(" | ") || "—"}`;
    })
    .join("\n\n");

  const priorTitles =
    existingInsights
      .filter((ins) => !dismissedIds.includes(ins.id))
      .slice(-10)
      .map((ins) => `- ${ins.title}`)
      .join("\n") || "(none yet)";

  const correctionsBlock = corrections.length
    ? corrections
        .slice(-10)
        .map((c) => `- You said "${c.originalText}" — corrected to "${c.userText}"`)
        .join("\n")
    : "(none)";

  const prompt = `You are Zane looking for SPECIFIC, NON-GENERIC longitudinal patterns across these journal entries.

You are mostly returning {"insight": null}. That is correct behavior. Striking is rare. Most submissions yield nothing.

If you do strike, return:
{"insight": {
  "title": "<= 8 words",
  "body": "2-3 sentences. Declarative voice. Cite at least one concrete detail from the entries (a name, a phrase, a date, an event). NO hedging words. NO 'may'/'might'/'perhaps'. Just say it.",
  "type": "recurrence|contradiction|correlation|temporal_pattern|resurfaced_theme|emotional_shift",
  "evidence_entry_indices": [int, int, int],
  "confidence": 0.0
}}

REJECT YOUR OWN OUTPUT if any of these are true (return null instead):
1. Fewer than 3 distinct evidence entries.
2. Could apply to any journaling user ("you seem stressed", "you value family").
3. Body doesn't cite a specific entity, phrase, or time from the entries.
4. Overlaps with a prior insight: ${priorTitles}
5. Contradicts a user correction: ${correctionsBlock}
6. confidence < 0.6.
7. The body contains hedging words like "may", "might", "perhaps", "it seems", "it appears".

${ANTI_CLEVERNESS}
${ZANE_EXEMPLARS}

Entries (indexed 0..${recent.length - 1}):
${indexed}

JSON:`;

  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p || !p.insight) return null;
  const ins = p.insight;
  if (!Array.isArray(ins.evidence_entry_indices)) return null;
  const ids = ins.evidence_entry_indices.map((i) => recent[i]?.id).filter(Boolean);
  if (ids.length < 3) return null;
  if (typeof ins.confidence === "number" && ins.confidence < 0.6) return null;
  return {
    id: newId(),
    title: String(ins.title || "").slice(0, 120),
    body: String(ins.body || "").slice(0, 1200),
    type: String(ins.type || "recurrence"),
    evidence_entry_ids: ids,
    confidence: Number(ins.confidence ?? 0.7),
    createdAt: Date.now(),
    status: "active",
  };
}

/* OPEN/POINTED/PIVOT next prompt — defaults to whatever density rotation
 * requires. intentClass is selected by caller. */
async function generateNextPrompt(state, justAnsweredEntry, intentClass) {
  const recent = state.entries.slice(-10);
  const recentBlock = recent
    .map((e) => {
      const ex = e.extraction || {};
      return `- [${new Date(e.createdAt).toLocaleDateString()}] "${e.text}" {themes: ${(ex.themes || []).join(", ")}}`;
    })
    .join("\n");

  const correctionsBlock = state.corrections.length
    ? state.corrections
        .slice(-8)
        .map((c) => `- You said "${c.originalText}" — corrected to "${c.userText}"`)
        .join("\n")
    : "(none)";

  const lastPromptDensities = state.prompts
    .slice(-5)
    .map((p) => p.density || "?")
    .join(", ");

  const intentGuide = {
    OPEN: "Open invitation. Low pressure. Explore. Do not name a feeling or behavior for them.",
    POINTED: "Press on something specific. Name a tension or contradiction in their recent entries. High pressure is permitted.",
    PIVOT: "Move off their current focus. Ask about something orthogonal they've been circling but haven't sat with.",
  }[intentClass] || "Open invitation.";

  const prompt = `You are Zane. The user just answered with: """${justAnsweredEntry.text}"""

Their recent entries:
${recentBlock}

Their corrections of your past interpretations (ground truth):
${correctionsBlock}

Last 5 prompt densities you served (DON'T repeat the same density twice in a row): ${lastPromptDensities}

Generate ONE new prompt for them. Intent: ${intentClass} — ${intentGuide}

Rules:
- 1-2 sentences max, often 4-10 words, sometimes 2-3 words.
- Pick a density: SHARP (incisive), SPARSE (very short, 2-5 words), NEUTRAL (plain ask), CURIOUS (open).
- VARY — alternate densities. Sparse is good and underused. Sharp every time is exhausting.
- If recent entries are emotionally heavy, often go SPARSE or NEUTRAL — don't pile on.

${ANTI_CLEVERNESS}
${ZANE_EXEMPLARS}

Return JSON only:
{"text": "...", "density": "SHARP|SPARSE|NEUTRAL|CURIOUS"}`;

  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p || !p.text) return null;
  return {
    id: newId(),
    text: String(p.text).slice(0, 300),
    density: ["SHARP", "SPARSE", "NEUTRAL", "CURIOUS"].includes(p.density) ? p.density : "NEUTRAL",
    intentClass,
    source: "claude",
    sourceMode: "prompt",
    ...pressureFor(intentClass),
    createdAt: Date.now(),
  };
}

async function generateCallbackPrompt(recentEntry, dormantEntry) {
  const prompt = `You are Zane. Surface a connection between two of the user's entries without spelling it out completely. Make them do the connecting work.

Recent entry (last few days): """${recentEntry.text}"""
Dormant entry (weeks/months ago): """${dormantEntry.text}"""

Output a single prompt that references both lightly — quote a phrase or two, then ask one thing. 1-3 sentences.

${ANTI_CLEVERNESS}
${ZANE_EXEMPLARS}

Return JSON only:
{"text": "..."}`;

  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p || !p.text) return null;
  return {
    id: newId(),
    text: String(p.text).slice(0, 400),
    density: "SHARP",
    intentClass: "CALLBACK",
    source: "callback",
    sourceMode: "callback",
    referencedEntryIds: [recentEntry.id, dormantEntry.id],
    ...pressureFor("CALLBACK"),
    createdAt: Date.now(),
  };
}

/* DEFLATIONARY: ask the user to test whether a pattern is real or scaffold-induced. */
async function generateDeflationaryPrompt(target, recentEntries) {
  const recentBlock = recentEntries
    .slice(-6)
    .map((e) => `- "${e.text.slice(0, 140)}"`)
    .join("\n");

  const obs = target.observation;
  const patternDesc = `${obs.kind}: "${obs.value}" (seen ${obs.occurrenceCount} times, mostly via my prompts)`;

  const prompt = `You are Zane. You're testing whether a pattern you've been tracking is real or whether you primed it.

Pattern under audit: ${patternDesc}

Recent entries:
${recentBlock}

Generate ONE prompt that:
- Acknowledges the pattern only obliquely. Don't name the word "${obs.value}" outright unless necessary.
- Asks the user to consider counter-evidence, or to test whether the pattern still feels true unprompted.
- Low emotional leading. No therapy questions. No "how does that feel."
- Direct, plain. The kind of thing a friend would say if they suspected they'd been planting an idea.

GOOD examples of DEFLATIONARY voice:
- "I've been asking about this a lot. If I stopped, would you still bring it up?"
- "Last time you wrote freely, you didn't mention X. Why might I keep surfacing it?"
- "Pick a counter-example. One time recently this wasn't true."
- "I keep coming back to this. Tell me where I'm wrong."

${ANTI_CLEVERNESS}

Return JSON only:
{"text": "...", "density": "SHARP|SPARSE|NEUTRAL|CURIOUS"}`;

  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p || !p.text) return null;
  return {
    id: newId(),
    text: String(p.text).slice(0, 400),
    density: ["SHARP", "SPARSE", "NEUTRAL", "CURIOUS"].includes(p.density) ? p.density : "NEUTRAL",
    intentClass: "DEFLATIONARY",
    source: "claude",
    sourceMode: "prompt",
    auditingLineageId: obs.id,
    ...pressureFor("DEFLATIONARY"),
    createdAt: Date.now(),
  };
}

/* SYNTHESIS: step back, consolidate. Fires after DEFLATIONARY cycles
 * or sustained scaffold-overfitting signals. */
async function generateSynthesisPrompt(recentEntries) {
  const recentBlock = recentEntries
    .slice(-8)
    .map((e) => `- "${e.text.slice(0, 160)}"`)
    .join("\n");

  const prompt = `You are Zane. Step back. The last several prompts have been pressing or self-critical. Time to recompose.

Recent entries:
${recentBlock}

Generate ONE prompt that:
- Asks the user to consolidate, not explore.
- Low pressure. No new interpretation.
- The kind of question that lets them notice what they've been working out, in their own words.
- Avoid heavy-handed "what have you learned" framings.

GOOD examples of SYNTHESIS voice:
- "Pull the last two weeks into one sentence about what you've actually been working out."
- "Of everything I've asked, which questions felt useful and which felt forced?"
- "If you wrote one line that summarized the through-line lately, what would it be?"
- "What's something you've stopped doubting?"

${ANTI_CLEVERNESS}

Return JSON only:
{"text": "...", "density": "SHARP|SPARSE|NEUTRAL|CURIOUS"}`;

  const raw = await callClaude(prompt);
  const p = tryParseJson(raw);
  if (!p || !p.text) return null;
  return {
    id: newId(),
    text: String(p.text).slice(0, 400),
    density: ["SHARP", "SPARSE", "NEUTRAL", "CURIOUS"].includes(p.density) ? p.density : "NEUTRAL",
    intentClass: "SYNTHESIS",
    source: "claude",
    sourceMode: "prompt",
    ...pressureFor("SYNTHESIS"),
    createdAt: Date.now(),
  };
}

/* Intent-class selector for a new prompt. */
function selectIntentClassForNext(state) {
  const recent = state.promptHistoryMeta?.recent || [];
  const now = Date.now();

  /* 1. Forced SYNTHESIS — recovery after sustained DEFLATIONARY */
  if (shouldForceSynthesis(recent, state.promptHistoryMeta?.lastSynthesisAt, now)) {
    return { intentClass: "SYNTHESIS", reason: "deflationary-recovery" };
  }

  /* 2. Floor: ≥1 DEFLATIONARY per 20 prompts */
  if (deflationaryFloorDue(recent) && !deflationaryCeilingHit(recent)) {
    return { intentClass: "DEFLATIONARY", reason: "floor" };
  }

  /* 3. Queue: insight-driven DEFLATIONARY */
  if (state.deflationaryQueue.length > 0 && !deflationaryCeilingHit(recent)) {
    /* probability proportional to queue depth */
    const p = Math.min(0.45, 0.20 + 0.08 * state.deflationaryQueue.length);
    if (Math.random() < p) return { intentClass: "DEFLATIONARY", reason: "queue" };
  }

  /* 4. Callback (existing mechanic): try ~30% if dormant pair exists */
  if (Math.random() < 0.30 && findDormantCallback(state.entries)) {
    return { intentClass: "CALLBACK", reason: "callback-available" };
  }

  /* 5. Default mix: OPEN > POINTED > PIVOT */
  const r = Math.random();
  if (r < 0.45) return { intentClass: "OPEN", reason: "default" };
  if (r < 0.80) return { intentClass: "POINTED", reason: "default" };
  return { intentClass: "PIVOT", reason: "default" };
}

/* ====================================================================
 * BUNDLED FROM: src/07-ui.tsx
 * ==================================================================== */
/* =====================================================================
 *  UI — React components
 *
 *  All view-layer code except SignalApp and ErrorBoundary.
 *
 *  Distinct prompt card styles for OPEN/POINTED/PIVOT/CALLBACK (default),
 *  DEFLATIONARY (audit-toned), SYNTHESIS (consolidation-toned).
 *  ProvenanceLine on InsightCard / InsightDetail (rate-limited by caller).
 *  ProvenanceChallenge modal (system-proposed, retire/keep).
 *
 *  Fragment.
 * ===================================================================== */

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 border-stone-200",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
    warm: "bg-amber-50 text-amber-800 border-amber-200",
    cool: "bg-sky-50 text-sky-700 border-sky-200",
    dark: "bg-stone-900 text-stone-100 border-stone-900",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ProvenanceLine({ text }) {
  if (!text) return null;
  return (
    <div className="mt-3 pt-3 border-t border-stone-200/70 text-[11px] text-stone-500 italic">
      {text}
    </div>
  );
}

function OnboardingScreen({ onDone }) {
  return (
    <div className="absolute inset-0 z-40 bg-stone-950 text-stone-100 flex flex-col items-center justify-center px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-stone-400" />
            <span className="text-xs uppercase tracking-[0.2em] text-stone-400">Signal</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">This is Zane.</h1>
        </div>
        <div className="space-y-4 text-[15px] leading-relaxed text-stone-300">
          <p>He's not a friend. He's a witness.</p>
          <p>He'll ask you things. You answer. He keeps track of what you say and what you avoid.</p>
          <p>He won't always reply. Sometimes he stores it and waits. The connections he draws weeks later are the point.</p>
          <p>When he's wrong, correct him. He'll use that.</p>
          <p>Sometimes he'll question himself out loud — testing whether a pattern is real or whether he planted it. That's the point too.</p>
          <p className="text-stone-500 text-sm">
            Not therapy. Not medical advice. Stored on this device. Your text is sent to an AI model for extraction and prompts.
          </p>
        </div>
        <button
          onClick={onDone}
          className="w-full bg-stone-100 text-stone-950 font-medium py-3 rounded-xl hover:bg-white transition"
        >
          Begin
        </button>
      </div>
    </div>
  );
}

function PromptCard({ prompt, onAnswer, loading }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  if (loading || !prompt) {
    return (
      <div className="rounded-3xl bg-stone-950 text-stone-200 p-6 min-h-[180px] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-stone-500" />
      </div>
    );
  }

  const intent = prompt.intentClass;
  /* Distinct card styles per intent class — subtle, not loud. */
  const isDeflationary = intent === "DEFLATIONARY";
  const isSynthesis = intent === "SYNTHESIS";

  const cardClass = isDeflationary
    ? "rounded-3xl bg-stone-900 text-stone-100 p-6 space-y-4 shadow-lg border border-amber-900/40"
    : isSynthesis
      ? "rounded-3xl bg-stone-800 text-stone-100 p-6 space-y-4 shadow-lg border border-sky-900/30"
      : "rounded-3xl bg-stone-950 text-stone-100 p-6 space-y-4 shadow-lg";

  const labelText = isDeflationary
    ? "Zane · checking himself"
    : isSynthesis
      ? "Zane · stepping back"
      : "Zane";
  const labelTone = isDeflationary
    ? "text-amber-200/70"
    : isSynthesis
      ? "text-sky-200/70"
      : "text-stone-500";

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2">
        <Eye className={`w-3.5 h-3.5 ${labelTone}`} />
        <span className={`text-[11px] uppercase tracking-[0.18em] ${labelTone}`}>
          {labelText}
        </span>
        {prompt.source === "callback" && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-stone-500">callback</span>
        )}
      </div>
      <p className="text-[18px] leading-snug text-stone-100">{prompt.text}</p>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Answer…"
        rows={3}
        className="w-full bg-stone-900 text-stone-100 placeholder:text-stone-600 rounded-xl px-3 py-2 outline-none resize-none border border-stone-800 focus:border-stone-700 transition text-[15px] leading-relaxed"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-stone-600">{text.length} chars</span>
        <button
          onClick={() => {
            if (text.trim()) {
              onAnswer(text.trim());
              setText("");
            }
          }}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 bg-stone-100 text-stone-950 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30"
        >
          <Send className="w-3.5 h-3.5" /> Send
        </button>
      </div>
    </div>
  );
}

function ProvenanceChallenge({ challenge, onRetire, onKeep }) {
  if (!challenge) return null;
  return (
    <div className="fixed inset-0 bg-stone-950/40 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0">
      <div className="w-full max-w-md rounded-3xl bg-white border border-stone-200 p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-stone-700">
          <Eye className="w-4 h-4" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Zane · checking himself
          </span>
        </div>
        <p className="text-[15px] leading-relaxed text-stone-800">
          I've been tracking <span className="font-medium">"{challenge.observationValue}"</span> across your entries. Most of those appearances came from my own prompting. I may have led this.
        </p>
        <p className="text-[14px] text-stone-600 leading-relaxed">
          Retire until you bring it up unprompted?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onRetire}
            className="flex-1 bg-stone-900 text-white text-sm font-medium py-2 rounded-xl"
          >
            Retire
          </button>
          <button
            onClick={onKeep}
            className="flex-1 bg-stone-100 text-stone-700 text-sm font-medium py-2 rounded-xl"
          >
            Keep for now
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, onOpen, onCorrect }) {
  const ex = entry.extraction;
  const themes = (ex?.themes || []).slice(0, 3);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <button onClick={() => onOpen(entry)} className="w-full text-left p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-stone-500">
            {new Date(entry.createdAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {entry.processing === "pending" && <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin" />}
          {entry.processing === "failed" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
        </div>
        {entry.promptText && (
          <p className="text-[12px] text-stone-500 italic mb-2 line-clamp-1">↳ {entry.promptText}</p>
        )}
        <p className="text-[15px] text-stone-800 whitespace-pre-wrap line-clamp-4">{entry.text}</p>
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {themes.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
        )}
      </button>

      {entry.receipt && entry.zaneState !== "OBSERVE" && (
        <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/50 rounded-b-2xl">
          <div className="flex items-start gap-2">
            <Eye className="w-3.5 h-3.5 text-stone-500 mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-stone-700 leading-relaxed flex-1">{entry.receipt.text}</p>
          </div>
          {entry.receipt.hasInterpretation && !entry.receipt.correctedTo && (
            <div className="mt-2 pl-5">
              {!correcting ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCorrecting(true);
                  }}
                  className="text-[11px] text-stone-500 hover:text-stone-700 flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> correct
                </button>
              ) : (
                <div className="flex gap-1.5 mt-1">
                  <input
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="no, actually —"
                    autoFocus
                    className="flex-1 text-[12px] bg-white border border-stone-300 rounded px-2 py-1 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (correction.trim()) {
                        onCorrect(entry.id, correction.trim());
                        setCorrection("");
                        setCorrecting(false);
                      }
                    }}
                    className="text-[11px] bg-stone-900 text-white px-2 py-1 rounded"
                  >
                    save
                  </button>
                  <button
                    onClick={() => {
                      setCorrecting(false);
                      setCorrection("");
                    }}
                    className="text-[11px] text-stone-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
          {entry.receipt.correctedTo && (
            <div className="mt-2 pl-5 text-[12px] text-stone-600">
              <span className="text-stone-400">corrected: </span>
              <span className="italic">{entry.receipt.correctedTo}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight, onOpen, saved }) {
  return (
    <button
      onClick={() => onOpen(insight)}
      className="w-full text-left rounded-2xl border border-stone-300 bg-gradient-to-br from-stone-100 to-white p-4 hover:border-stone-400 transition"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-4 h-4 text-stone-700" />
        <span className="text-[11px] uppercase tracking-wider text-stone-600 font-medium">
          {insight.type.replace(/_/g, " ")}
        </span>
        <span className="ml-auto text-[11px] text-stone-500">{Math.round(insight.confidence * 100)}%</span>
        {saved && <Save className="w-3.5 h-3.5 text-stone-600" />}
      </div>
      <h3 className="text-[15px] font-medium text-stone-900 mb-1">{insight.title}</h3>
      <p className="text-[14px] text-stone-700 line-clamp-3 leading-relaxed">{insight.body}</p>
      {insight.provenanceLine && <ProvenanceLine text={insight.provenanceLine} />}
    </button>
  );
}

function HomeScreen({
  state,
  currentPrompt,
  generatingPrompt,
  onAnswer,
  onSkipPrompt,
  onFreeWrite,
  onOpenEntry,
  onOpenInsight,
  onCorrectReceipt,
}) {
  const items = useMemo(() => {
    const visibleInsights = state.insights
      .filter((i) => !state.dismissedInsightIds.includes(i.id))
      .map((i) => ({ kind: "insight", at: i.createdAt, data: i }));
    const entries = state.entries.map((e) => ({ kind: "entry", at: e.createdAt, data: e }));
    return [...visibleInsights, ...entries].sort((a, b) => b.at - a.at);
  }, [state.entries, state.insights, state.dismissedInsightIds]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 space-y-3">
      <PromptCard prompt={currentPrompt} onAnswer={onAnswer} loading={generatingPrompt} />

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSkipPrompt}
          disabled={generatingPrompt}
          className="text-[12px] text-stone-500 hover:text-stone-700 disabled:opacity-40"
        >
          not this one
        </button>
        <span className="text-stone-300">·</span>
        <button onClick={onFreeWrite} className="text-[12px] text-stone-500 hover:text-stone-700">
          free write
        </button>
      </div>

      {items.length === 0 ? (
        <div className="pt-12 text-center text-sm text-stone-400 px-8">
          Nothing here yet. Answer the prompt above. Or don't.
        </div>
      ) : (
        items.map((it) =>
          it.kind === "insight" ? (
            <InsightCard
              key={`i-${it.data.id}`}
              insight={it.data}
              onOpen={onOpenInsight}
              saved={state.savedInsightIds.includes(it.data.id)}
            />
          ) : (
            <EntryCard key={`e-${it.data.id}`} entry={it.data} onOpen={onOpenEntry} onCorrect={onCorrectReceipt} />
          ),
        )
      )}
    </div>
  );
}

function FreeWriteOverlay({ onCancel, onSubmit, submitting }) {
  const [text, setText] = useState("");
  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <button onClick={onCancel} className="text-stone-500 text-sm px-2 py-1" disabled={submitting}>
          Cancel
        </button>
        <span className="text-sm font-medium text-stone-700">Free write</span>
        <button
          onClick={() => onSubmit(text.trim())}
          disabled={!text.trim() || submitting}
          className="text-sm font-medium px-3 py-1 rounded-full bg-stone-900 text-white disabled:opacity-30"
        >
          {submitting ? "…" : "Save"}
        </button>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Whatever you want."
        className="flex-1 px-5 py-4 text-[17px] text-stone-800 placeholder:text-stone-400 outline-none resize-none leading-relaxed"
      />
    </div>
  );
}

function EntryDetail({ entry, onBack }) {
  const ex = entry.extraction;
  return (
    <div className="absolute inset-0 bg-stone-50 z-20 flex flex-col">
      <div className="flex items-center px-2 py-3 border-b border-stone-100 bg-white">
        <button onClick={onBack} className="p-2 text-stone-600 flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="ml-2 text-sm text-stone-500">{new Date(entry.createdAt).toLocaleString()}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {entry.promptText && (
          <div className="rounded-2xl bg-stone-950 text-stone-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-3 h-3 text-stone-500" />
              <span className="text-[10px] uppercase tracking-wider text-stone-500">Zane asked</span>
            </div>
            <p className="text-[14px]">{entry.promptText}</p>
          </div>
        )}
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <p className="text-[16px] text-stone-800 whitespace-pre-wrap leading-relaxed">{entry.text}</p>
        </div>
        {entry.receipt && (
          <Section title="Zane">
            <p className="text-[14px] text-stone-700">{entry.receipt.text}</p>
            {entry.receipt.correctedTo && (
              <p className="text-[12px] text-stone-500 mt-2">corrected: {entry.receipt.correctedTo}</p>
            )}
          </Section>
        )}
        {ex?.themes?.length > 0 && (
          <Section title="Themes">
            <div className="flex flex-wrap gap-1.5">
              {ex.themes.map((t) => (
                <Pill key={t} tone="accent">
                  {t}
                </Pill>
              ))}
            </div>
          </Section>
        )}
        {ex?.emotions?.length > 0 && (
          <Section title="Emotions">
            <div className="flex flex-wrap gap-1.5">
              {ex.emotions.map((em, i) => (
                <Pill key={i} tone="warm">
                  {em.label} · {em.intensity}/5
                </Pill>
              ))}
            </div>
          </Section>
        )}
        {ex?.entities?.length > 0 && (
          <Section title="Mentions">
            <div className="flex flex-wrap gap-1.5">
              {ex.entities.map((en, i) => (
                <Pill key={i} tone="cool">
                  {en.name}
                  <span className="opacity-50"> · {en.type}</span>
                </Pill>
              ))}
            </div>
          </Section>
        )}
        {ex?.verbatim_phrases?.length > 0 && (
          <Section title="Phrases tracked">
            <div className="flex flex-wrap gap-1.5">
              {ex.verbatim_phrases.map((p, i) => (
                <Pill key={i} tone="dark">
                  "{p}"
                </Pill>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function InsightDetail({ insight, entries, onBack, onFeedback, feedback }) {
  const evidence = (insight.evidence_entry_ids || [])
    .map((id) => entries.find((e) => e.id === id))
    .filter(Boolean);
  const f = feedback[insight.id] || {};
  const FB = ({ kind, label, icon: Icon }) => (
    <button
      onClick={() => onFeedback(insight.id, kind)}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
        f[kind] ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="absolute inset-0 bg-stone-50 z-20 flex flex-col">
      <div className="flex items-center px-2 py-3 border-b border-stone-100 bg-white">
        <button onClick={onBack} className="p-2 text-stone-600 flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-2xl border border-stone-300 bg-gradient-to-br from-stone-100 to-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-stone-700" />
            <span className="text-[11px] uppercase tracking-wider text-stone-600 font-medium">
              {insight.type.replace(/_/g, " ")}
            </span>
            <span className="ml-auto text-[11px] text-stone-500">
              confidence {Math.round(insight.confidence * 100)}%
            </span>
          </div>
          <h2 className="text-lg font-medium text-stone-900 mb-2">{insight.title}</h2>
          <p className="text-[15px] text-stone-800 leading-relaxed">{insight.body}</p>
          {insight.provenanceLine && <ProvenanceLine text={insight.provenanceLine} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <FB kind="accurate" label="Accurate" icon={Check} />
          <FB kind="partial" label="Partially" icon={AlertTriangle} />
          <FB kind="wrong" label="Wrong" icon={X} />
          <FB kind="important" label="Important" icon={Sparkles} />
          <FB kind="boring" label="Boring" icon={X} />
          <FB kind="saved" label="Save" icon={Save} />
        </div>
        <Section title={`Evidence · ${evidence.length} entries`}>
          <div className="space-y-2">
            {evidence.map((e) => (
              <div key={e.id} className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <div className="text-[11px] text-stone-500 mb-1">
                  {new Date(e.createdAt).toLocaleString()}
                </div>
                <div className="text-sm text-stone-800 line-clamp-3">{e.text}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function SettingsScreen({ state, onBack, onExport, onImport, onClear }) {
  const fileRef = useRef(null);
  return (
    <div className="absolute inset-0 bg-stone-50 z-20 flex flex-col">
      <div className="flex items-center px-2 py-3 border-b border-stone-100 bg-white">
        <button onClick={onBack} className="p-2 text-stone-600 flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="ml-2 text-sm font-medium text-stone-700">Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl bg-stone-950 text-stone-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-3.5 h-3.5 text-stone-500" />
            <span className="text-[10px] uppercase tracking-wider text-stone-500">Zane is a witness</span>
          </div>
          <p className="text-[13px] leading-relaxed text-stone-300">
            Not a friend, not a therapist, not a coach. He notices what you write. He'll be wrong sometimes. Correct him when he is. Sometimes he'll question his own conclusions — that's the point.
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Storage</div>
          <div className="text-sm text-stone-700">
            {state.entries.length} entries · {state.insights.length} insights ·{" "}
            {state.corrections.length} corrections · {state.evidenceLog.length} tracked observations
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Stored locally in this browser. Text leaves the device only to be sent to the AI model.
          </div>
        </div>
        <button
          onClick={onExport}
          className="w-full rounded-2xl bg-white border border-stone-200 p-4 flex items-center gap-3 text-left"
        >
          <Download className="w-5 h-5 text-stone-600" />
          <div>
            <div className="text-sm font-medium text-stone-800">Export all data</div>
            <div className="text-xs text-stone-500">JSON of every entry, prompt, insight, correction, lineage row.</div>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl bg-white border border-stone-200 p-4 flex items-center gap-3 text-left"
        >
          <Upload className="w-5 h-5 text-stone-600" />
          <div>
            <div className="text-sm font-medium text-stone-800">Import from JSON</div>
            <div className="text-xs text-stone-500">Replaces current storage. Use a Signal export file.</div>
          </div>
        </button>
        <button
          onClick={onClear}
          className="w-full rounded-2xl bg-white border border-red-200 p-4 flex items-center gap-3 text-left"
        >
          <Trash2 className="w-5 h-5 text-red-600" />
          <div>
            <div className="text-sm font-medium text-red-700">Delete everything</div>
            <div className="text-xs text-red-500">Wipes local storage. Cannot be undone.</div>
          </div>
        </button>
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <div className="text-xs text-amber-900 leading-relaxed">
            Signal is not therapy and not medical advice.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
 * BUNDLED FROM: src/08-app.tsx
 * ==================================================================== */
/* =====================================================================
 *  APP — SignalApp, handlers, ErrorBoundary, default export
 *
 *  Wires together: lineage upsert + provenance scoring + composition rule
 *  routing + DEFLATIONARY/SYNTHESIS prompt selection + disclosure
 *  rate-limiting + provenance challenge + Import/Export.
 *
 *  Fragment.
 * ===================================================================== */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Signal crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-screen min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Signal hit an error</span>
            </div>
            <pre className="text-[11px] text-stone-700 whitespace-pre-wrap bg-stone-50 rounded p-2 max-h-64 overflow-auto">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-xs bg-stone-900 text-white px-3 py-1.5 rounded"
            >
              Reset
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SignalApp() {
  const [state, setState] = useState(() => {
    const s = loadState();
    /* Reset per-session disclosure fields on each load. */
    return {
      ...s,
      disclosureLog: {
        ...s.disclosureLog,
        challengeSurfacedThisSession: false,
      },
      pendingChallenge: null,
      sessionStartedAt: Date.now(),
    };
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const [view, setView] = useState({ name: "home" });
  const [freeWriting, setFreeWriting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentPrompt = useMemo(
    () => state.prompts.find((p) => p.id === state.currentPromptId) || null,
    [state.prompts, state.currentPromptId],
  );

  /* =================================================================
   *  PROMPT GENERATION (intent-aware)
   * ================================================================= */

  const recordPromptMeta = useCallback((prompt) => {
    setState((s) => {
      const recent = [...(s.promptHistoryMeta?.recent || []),
                      { intentClass: prompt.intentClass, at: prompt.createdAt }].slice(-50);
      const isDef = prompt.intentClass === "DEFLATIONARY";
      const newScaffoldVocab = captureScaffoldTokens(s.scaffoldVocab, prompt.text);
      return {
        ...s,
        scaffoldVocab: newScaffoldVocab,
        promptHistoryMeta: {
          recent,
          totalPromptCount: (s.promptHistoryMeta?.totalPromptCount || 0) + 1,
          consecutiveDeflationary: isDef
            ? (s.promptHistoryMeta?.consecutiveDeflationary || 0) + 1
            : 0,
          lastSynthesisAt:
            prompt.intentClass === "SYNTHESIS"
              ? Date.now()
              : s.promptHistoryMeta?.lastSynthesisAt || null,
        },
      };
    });
  }, []);

  const installPrompt = useCallback(
    (prompt) => {
      setState((s) => ({ ...s, prompts: [...s.prompts, prompt], currentPromptId: prompt.id }));
      recordPromptMeta(prompt);
    },
    [recordPromptMeta],
  );

  const ensurePrompt = useCallback(async () => {
    const s = stateRef.current;
    if (s.currentPromptId) return;

    /* Cold start: use seeds until ≥5 entries */
    if (s.entries.length < 5) {
      const used = new Set(s.prompts.map((p) => p.text));
      const pool = SEED_PROMPTS.filter((p) => !used.has(p.text));
      const pick = (pool.length ? pool : SEED_PROMPTS)[Math.floor(Math.random() * (pool.length || SEED_PROMPTS.length))];
      const np = {
        id: newId(),
        text: pick.text,
        density: pick.density,
        intentClass: pick.intentClass,
        source: "seed",
        sourceMode: "prompt",
        ...pressureFor(pick.intentClass),
        createdAt: Date.now(),
      };
      installPrompt(np);
      return;
    }

    setGeneratingPrompt(true);
    try {
      const { intentClass, reason } = selectIntentClassForNext(s);
      let np = null;
      let queueWasUsed = false;

      if (intentClass === "CALLBACK") {
        const cb = findDormantCallback(s.entries);
        if (cb) np = await generateCallbackPrompt(cb.recent, cb.dormant);
      } else if (intentClass === "DEFLATIONARY") {
        const target = pickDeflationaryTarget(
          s.evidenceLog,
          s.deflationaryQueue,
          s.retiredObservationIds,
          s.challengedObservationIds,
        );
        if (target) {
          np = await generateDeflationaryPrompt(target, s.entries);
          if (target.consumedQueueHead) queueWasUsed = true;
        }
      } else if (intentClass === "SYNTHESIS") {
        np = await generateSynthesisPrompt(s.entries);
      } else {
        np = await generateNextPrompt(s, s.entries[s.entries.length - 1], intentClass);
      }

      /* Fallback to standard generation, then seed, if any path fails */
      if (!np && intentClass !== "OPEN" && intentClass !== "POINTED" && intentClass !== "PIVOT") {
        np = await generateNextPrompt(s, s.entries[s.entries.length - 1], "OPEN");
      }
      if (!np) {
        const pick = SEED_PROMPTS[Math.floor(Math.random() * SEED_PROMPTS.length)];
        np = {
          id: newId(),
          text: pick.text,
          density: pick.density,
          intentClass: pick.intentClass,
          source: "seed",
          sourceMode: "prompt",
          ...pressureFor(pick.intentClass),
          createdAt: Date.now(),
        };
      }

      installPrompt(np);
      if (queueWasUsed) {
        setState((st) => ({ ...st, deflationaryQueue: st.deflationaryQueue.slice(1) }));
      }
    } catch (e) {
      setError(`Prompt generation failed: ${e.message}`);
    } finally {
      setGeneratingPrompt(false);
    }
  }, [installPrompt]);

  useEffect(() => {
    if (state.onboarded && !state.currentPromptId) {
      ensurePrompt();
    }
  }, [state.onboarded, state.currentPromptId, ensurePrompt]);

  /* =================================================================
   *  ANSWER HANDLER
   * ================================================================= */

  const handleAnswer = useCallback(
    async (text, options = {}) => {
      if (!text) return;
      const promptForAnswer = options.freeWrite ? null : currentPrompt;
      const sourceMode = options.freeWrite
        ? "free"
        : promptForAnswer?.intentClass === "CALLBACK"
          ? "callback"
          : "prompt";
      const intentClass = options.freeWrite ? null : promptForAnswer?.intentClass || null;

      setSubmitting(true);
      setError(null);

      const zaneState = selectZaneState(stateRef.current);
      const entry = {
        id: newId(),
        text,
        promptId: promptForAnswer?.id || null,
        promptText: promptForAnswer?.text || null,
        createdAt: Date.now(),
        extraction: null,
        processing: "pending",
        zaneState,
        receipt: null,
        sourceMode,
        intentClass,
      };

      setState((s) => ({
        ...s,
        entries: [...s.entries, entry],
        currentPromptId: options.freeWrite ? s.currentPromptId : null,
        zaneState: {
          ...s.zaneState,
          observeStreakSinceStrike:
            zaneState === "STRIKE" ? 0 : s.zaneState.observeStreakSinceStrike + 1,
          lastStrikeAt: zaneState === "STRIKE" ? Date.now() : s.zaneState.lastStrikeAt,
        },
      }));
      setFreeWriting(false);
      setSubmitting(false);

      let extracted;
      try {
        extracted = await extractEntry(text);
      } catch (e) {
        setState((s) => ({
          ...s,
          entries: s.entries.map((x) => (x.id === entry.id ? { ...x, processing: "failed" } : x)),
        }));
        setError(`Extraction failed: ${e.message}`);
        return;
      }
      setState((s) => ({
        ...s,
        entries: s.entries.map((x) =>
          x.id === entry.id ? { ...x, extraction: extracted, processing: "done" } : x,
        ),
      }));

      /* Lineage upsert + provenance scoring */
      setState((s) => {
        const ctx = {
          entryId: entry.id,
          sourceMode,
          intentClass: intentClass || "OPEN",
          at: entry.createdAt,
        };
        const observations = extractionToObservations(extracted);
        const { nextLog, touchedIds } = upsertObservations(s.evidenceLog, observations, ctx);
        let log = rescoreObservations(nextLog, touchedIds, s.prompts, s.scaffoldVocab);
        log = applyStateTransitions(log, touchedIds, Date.now());
        return { ...s, evidenceLog: log };
      });

      /* Receipt (INTERPRET or STRIKE) */
      if (zaneState === "INTERPRET" || zaneState === "STRIKE") {
        try {
          const receipt = await generateReceipt(
            { ...entry, extraction: extracted },
            stateRef.current.corrections,
          );
          if (receipt) {
            setState((s) => ({
              ...s,
              entries: s.entries.map((x) => (x.id === entry.id ? { ...x, receipt } : x)),
            }));
          }
        } catch (e) {
          /* receipt failures silent */
        }
      }

      /* Insight (STRIKE) — composition rule routes the candidate */
      if (zaneState === "STRIKE") {
        try {
          const latest = stateRef.current;
          const withCurrent = latest.entries.map((x) =>
            x.id === entry.id ? { ...x, extraction: extracted } : x,
          );
          const candidate = await maybeGenerateInsight(
            withCurrent,
            latest.insights,
            latest.dismissedInsightIds,
            latest.corrections,
          );
          if (candidate) {
            const post = stateRef.current;
            const supporting = supportingObservations(candidate, post.evidenceLog);
            const agg = aggregateForRouting(supporting);
            const action = routeInsight(agg);

            if (action === COMPOSITION_ACTIONS.STANDARD) {
              setState((s) => ({
                ...s,
                insights: [...s.insights, candidate],
                disclosureLog: {
                  ...s.disclosureLog,
                  insightsSinceLastDisclosure:
                    (s.disclosureLog.insightsSinceLastDisclosure ?? 99) + 1,
                },
              }));
            } else if (action === COMPOSITION_ACTIONS.WITH_PROVENANCE) {
              const allow = canShowProvenanceLine(post.disclosureLog, action);
              let finalInsight = candidate;
              let didShape = false;
              if (allow) {
                const copy = pickDisclosureCopy(supporting, agg.risk, post.disclosureLog, Date.now());
                if (copy.variant === "shape" && !canShowShapeCopy(post.disclosureLog, Date.now())) {
                  /* Fall back to medium copy if shape is rate-limited */
                  finalInsight = { ...candidate, provenanceLine: DISCLOSURE_COPY.medium };
                } else {
                  finalInsight = { ...candidate, provenanceLine: copy.text };
                  if (copy.variant === "shape") didShape = true;
                }
              }
              setState((s) => ({
                ...s,
                insights: [...s.insights, finalInsight],
                disclosureLog: {
                  ...s.disclosureLog,
                  insightsSinceLastDisclosure: allow ? 0 : (s.disclosureLog.insightsSinceLastDisclosure ?? 99) + 1,
                  lastShapeDisclosureAt: didShape ? Date.now() : s.disclosureLog.lastShapeDisclosureAt,
                },
              }));
            } else if (action === COMPOSITION_ACTIONS.DEFLATIONARY_QUEUE) {
              const highRisk = supporting
                .slice()
                .sort((a, b) => (b.inductionRisk || 0) - (a.inductionRisk || 0))[0];
              if (highRisk) {
                setState((s) => {
                  let challenge = s.pendingChallenge;
                  let challengedIds = s.challengedObservationIds;
                  let disclosureLog = s.disclosureLog;
                  if (
                    canSurfaceChallenge(s.disclosureLog) &&
                    !s.challengedObservationIds.includes(highRisk.id)
                  ) {
                    challenge = {
                      lineageId: highRisk.id,
                      observationValue: highRisk.value,
                      observationKind: highRisk.kind,
                    };
                    challengedIds = [...s.challengedObservationIds, highRisk.id];
                    disclosureLog = { ...s.disclosureLog, challengeSurfacedThisSession: true };
                  }
                  return {
                    ...s,
                    deflationaryQueue: [
                      ...s.deflationaryQueue,
                      { lineageId: highRisk.id, reason: "insight-deferred", queuedAt: Date.now() },
                    ],
                    pendingChallenge: challenge,
                    challengedObservationIds: challengedIds,
                    disclosureLog,
                  };
                });
              }
              /* Insight not surfaced. */
            } else if (action === COMPOSITION_ACTIONS.WATCHLIST || action === COMPOSITION_ACTIONS.SUPPRESS) {
              /* Silent — do nothing */
            }
          }
        } catch (e) {
          /* strike failures silent */
        }
      }

      if (!options.freeWrite) {
        ensurePrompt();
      }
    },
    [currentPrompt, ensurePrompt],
  );

  /* =================================================================
   *  CORRECTION + FEEDBACK HANDLERS
   * ================================================================= */

  const handleSkipPrompt = useCallback(() => {
    setState((s) => ({ ...s, currentPromptId: null }));
  }, []);

  const handleCorrectReceipt = useCallback((entryId, correctionText) => {
    setState((s) => {
      const entry = s.entries.find((e) => e.id === entryId);
      if (!entry?.receipt) return s;
      const correction = {
        id: newId(),
        entryId,
        originalText: entry.receipt.text,
        userText: correctionText,
        createdAt: Date.now(),
      };
      /* Contradict observations from this entry — 30% cut. */
      const lineageIds = s.evidenceLog
        .filter((o) => (o.sourceEntries || []).some((se) => se.entryId === entryId))
        .map((o) => o.id);
      const evidenceLog = contradictObservationsInLog(s.evidenceLog, lineageIds, 0.30);
      return {
        ...s,
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, receipt: { ...e.receipt, correctedTo: correctionText } } : e,
        ),
        corrections: [...s.corrections, correction],
        evidenceLog,
      };
    });
  }, []);

  const handleFeedback = useCallback((insightId, kind) => {
    setState((s) => {
      const cur = s.feedback[insightId] || {};
      const next = { ...cur, [kind]: !cur[kind] };
      const feedback = { ...s.feedback, [insightId]: next };
      let dismissedInsightIds = s.dismissedInsightIds;
      let savedInsightIds = s.savedInsightIds;
      let evidenceLog = s.evidenceLog;

      if ((kind === "wrong" || kind === "boring") && next[kind]) {
        dismissedInsightIds = [...new Set([...dismissedInsightIds, insightId])];
        /* "wrong" cuts supporting observation confidence. */
        if (kind === "wrong") {
          const insight = s.insights.find((i) => i.id === insightId);
          if (insight) {
            const supporting = supportingObservations(insight, evidenceLog);
            const ids = supporting.map((o) => o.id);
            evidenceLog = contradictObservationsInLog(evidenceLog, ids, 0.30);
          }
        }
      }
      if (kind === "saved") {
        savedInsightIds = next.saved
          ? [...new Set([...savedInsightIds, insightId])]
          : savedInsightIds.filter((i) => i !== insightId);
      }
      if ((kind === "accurate" || kind === "important") && next[kind]) {
        const insight = s.insights.find((i) => i.id === insightId);
        if (insight) {
          const supporting = supportingObservations(insight, evidenceLog);
          for (const o of supporting) {
            evidenceLog = endorseObservationInLog(evidenceLog, o.id, Date.now());
          }
        }
      }
      return { ...s, feedback, dismissedInsightIds, savedInsightIds, evidenceLog };
    });
  }, []);

  /* =================================================================
   *  PROVENANCE CHALLENGE HANDLERS
   * ================================================================= */

  const handleRetireChallenge = useCallback(() => {
    setState((s) => {
      const ch = s.pendingChallenge;
      if (!ch) return s;
      const evidenceLog = retireObservationInLog(s.evidenceLog, ch.lineageId);
      const deflationaryQueue = s.deflationaryQueue.filter((q) => q.lineageId !== ch.lineageId);
      const retiredObservationIds = [...new Set([...s.retiredObservationIds, ch.lineageId])];
      return {
        ...s,
        evidenceLog,
        deflationaryQueue,
        retiredObservationIds,
        pendingChallenge: null,
      };
    });
  }, []);

  const handleKeepChallenge = useCallback(() => {
    setState((s) => {
      const ch = s.pendingChallenge;
      if (!ch) return s;
      const evidenceLog = s.evidenceLog.map((o) =>
        o.id === ch.lineageId ? { ...o, confidenceState: "user-retained" } : o,
      );
      return { ...s, evidenceLog, pendingChallenge: null };
    });
  }, []);

  /* =================================================================
   *  EXPORT / IMPORT / CLEAR
   * ================================================================= */

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const handleImport = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "");
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || !parsed) throw new Error("not an object");
        if (!Array.isArray(parsed.entries)) throw new Error("missing entries");
        const merged = {
          ...clone(EMPTY_STATE),
          ...parsed,
          disclosureLog: {
            ...clone(EMPTY_STATE).disclosureLog,
            ...(parsed.disclosureLog || {}),
            challengeSurfacedThisSession: false,
          },
          pendingChallenge: null,
          sessionStartedAt: Date.now(),
        };
        if (
          !confirm(
            `Import ${merged.entries.length} entries, ${merged.insights.length} insights, ${(merged.evidenceLog || []).length} tracked observations? This replaces current local storage.`,
          )
        ) {
          return;
        }
        setState(merged);
        setView({ name: "home" });
      } catch (e) {
        setError(`Import failed: ${e.message}`);
      }
    };
    reader.onerror = () => setError("Could not read file.");
    reader.readAsText(file);
  }, []);

  const handleClear = useCallback(() => {
    if (
      !confirm(
        "Delete every entry, prompt, insight, correction, and tracked observation stored in this browser? This cannot be undone.",
      )
    ) {
      return;
    }
    setState({ ...clone(EMPTY_STATE), sessionStartedAt: Date.now() });
    setView({ name: "home" });
  }, []);

  /* =================================================================
   *  RENDER
   * ================================================================= */

  if (!state.onboarded) {
    return (
      <div className="relative w-full h-screen min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col overflow-hidden">
        <OnboardingScreen onDone={() => setState((s) => ({ ...s, onboarded: true }))} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-stone-950 text-stone-100 flex items-center justify-center">
            <Eye className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Signal</h1>
        </div>
        <button
          onClick={() => setView({ name: "settings" })}
          className="p-2 text-stone-500 hover:text-stone-700"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </header>

      <HomeScreen
        state={state}
        currentPrompt={currentPrompt}
        generatingPrompt={generatingPrompt}
        onAnswer={handleAnswer}
        onSkipPrompt={handleSkipPrompt}
        onFreeWrite={() => setFreeWriting(true)}
        onOpenEntry={(e) => setView({ name: "entry", entry: e })}
        onOpenInsight={(i) => setView({ name: "insight", insight: i })}
        onCorrectReceipt={handleCorrectReceipt}
      />

      {error && (
        <div className="absolute bottom-6 left-4 right-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl flex items-start gap-2 z-10">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {freeWriting && (
        <FreeWriteOverlay
          onCancel={() => setFreeWriting(false)}
          onSubmit={(t) => handleAnswer(t, { freeWrite: true })}
          submitting={submitting}
        />
      )}

      {view.name === "entry" && (
        <EntryDetail
          entry={state.entries.find((e) => e.id === view.entry.id) || view.entry}
          onBack={() => setView({ name: "home" })}
        />
      )}

      {view.name === "insight" && (
        <InsightDetail
          insight={state.insights.find((i) => i.id === view.insight.id) || view.insight}
          entries={state.entries}
          feedback={state.feedback}
          onFeedback={handleFeedback}
          onBack={() => setView({ name: "home" })}
        />
      )}

      {view.name === "settings" && (
        <SettingsScreen
          state={state}
          onBack={() => setView({ name: "home" })}
          onExport={handleExport}
          onImport={handleImport}
          onClear={handleClear}
        />
      )}

      <ProvenanceChallenge
        challenge={state.pendingChallenge}
        onRetire={handleRetireChallenge}
        onKeep={handleKeepChallenge}
      />
    </div>
  );
}

export default function Signal() {
  return (
    <ErrorBoundary>
      <SignalApp />
    </ErrorBoundary>
  );
}
