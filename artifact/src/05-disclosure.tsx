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
