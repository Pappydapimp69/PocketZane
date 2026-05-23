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

