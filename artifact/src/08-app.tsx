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
