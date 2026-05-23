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
