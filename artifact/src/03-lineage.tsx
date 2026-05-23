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
