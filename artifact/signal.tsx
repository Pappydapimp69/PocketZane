import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Settings as SettingsIcon,
  Download,
  Trash2,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Save,
  ChevronLeft,
  Loader2,
} from "lucide-react";

const STORAGE_KEY = "signal_v1_state";

const EMPTY_STATE = {
  entries: [],
  insights: [],
  feedback: {},
  dismissedInsightIds: [],
  savedInsightIds: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(EMPTY_STATE), ...parsed };
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  } catch {
    const match = s.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return null;
  }
}

async function callClaude(prompt) {
  if (typeof window === "undefined" || !window.claude?.complete) {
    throw new Error(
      "window.claude.complete is unavailable. Run this inside a Claude.ai artifact."
    );
  }
  return await window.claude.complete(prompt);
}

async function extractEntry(text, mood) {
  const prompt = `You extract structured meaning from a single journal fragment.
Return ONLY valid JSON, no commentary, matching exactly this shape:
{
  "summary": "one-sentence neutral summary",
  "entities": [{"name": "string", "type": "PERSON|PLACE|PROJECT|CONCEPT"}],
  "emotions": [{"label": "string", "intensity": 1}],
  "themes": ["string"],
  "behaviors": ["string"]
}

Rules:
- Keep names canonical (e.g. "Mom" -> "mother", "the gym" -> "gym").
- intensity is an integer 1..5.
- Themes are short noun phrases ("social recovery", "career doubt").
- If no entities/emotions/themes/behaviors are present, return empty arrays.

${mood ? `User-supplied mood hint: ${mood}\n` : ""}Entry:
"""${text}"""

JSON:`;
  const raw = await callClaude(prompt);
  const parsed = tryParseJson(raw);
  if (!parsed) throw new Error("Extraction returned unparseable JSON");
  return {
    summary: String(parsed.summary || ""),
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    emotions: Array.isArray(parsed.emotions) ? parsed.emotions : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    behaviors: Array.isArray(parsed.behaviors) ? parsed.behaviors : [],
  };
}

async function maybeGenerateInsight(entries, existingInsights, dismissedIds) {
  if (entries.length < 3) return null;
  const recent = entries.slice(-20);
  const indexed = recent
    .map((e, i) => {
      const ex = e.extraction || {};
      const when = new Date(e.createdAt).toLocaleString();
      const themes = (ex.themes || []).join(", ") || "—";
      const emotions =
        (ex.emotions || [])
          .map((em) => `${em.label}(${em.intensity})`)
          .join(", ") || "—";
      const entities =
        (ex.entities || []).map((en) => en.name).join(", ") || "—";
      return `[${i}] ${when}
  text: ${e.text}
  themes: ${themes}
  emotions: ${emotions}
  entities: ${entities}`;
    })
    .join("\n\n");

  const priorTitles =
    existingInsights
      .filter((ins) => !dismissedIds.includes(ins.id))
      .slice(-10)
      .map((ins) => `- ${ins.title}`)
      .join("\n") || "(none yet)";

  const prompt = `You look for SPECIFIC, NON-GENERIC longitudinal patterns across these journal entries.

Output ONLY JSON. Two shapes are allowed:
{"insight": null}
or
{"insight": {
  "title": "short title (<= 8 words)",
  "body": "1-3 sentences. Must reference at least one concrete detail from the entries (a name, an event, a time). Use uncertainty hedges (may, appears, could).",
  "type": "recurrence|contradiction|correlation|temporal_pattern|resurfaced_theme|emotional_shift",
  "evidence_entry_indices": [int, int, int],
  "confidence": 0.0
}}

Hard rules — reject any insight that fails any of these:
1. At least 3 distinct evidence entries.
2. Could ONLY apply to this user (not "you seem stressed", "you value family", etc.).
3. Body explicitly cites a specific entity, theme, or time the user mentioned.
4. Different from these prior insights:
${priorTitles}
5. confidence >= 0.6.

If nothing meets the bar, return {"insight": null}. It is GOOD to return null often.

Entries (indexed 0..${recent.length - 1}):
${indexed}

JSON:`;

  const raw = await callClaude(prompt);
  const parsed = tryParseJson(raw);
  if (!parsed || !parsed.insight) return null;
  const ins = parsed.insight;
  if (!Array.isArray(ins.evidence_entry_indices)) return null;
  const ids = ins.evidence_entry_indices
    .map((i) => recent[i]?.id)
    .filter(Boolean);
  if (ids.length < 3) return null;
  if (typeof ins.confidence === "number" && ins.confidence < 0.6) return null;
  return {
    id: newId(),
    title: String(ins.title || "Untitled pattern").slice(0, 120),
    body: String(ins.body || "").slice(0, 1200),
    type: String(ins.type || "recurrence"),
    evidence_entry_ids: ids,
    confidence: Number(ins.confidence ?? 0.7),
    createdAt: Date.now(),
    status: "active",
  };
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 border-stone-200",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
    warm: "bg-amber-50 text-amber-800 border-amber-200",
    cool: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function EntryCard({ entry, onOpen }) {
  const ex = entry.extraction;
  const themes = (ex?.themes || []).slice(0, 3);
  return (
    <button
      onClick={() => onOpen(entry)}
      className="w-full text-left rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-stone-500">
          {new Date(entry.createdAt).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {entry.processing === "pending" && (
          <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin" />
        )}
        {entry.processing === "failed" && (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        )}
      </div>
      <p className="text-[15px] text-stone-800 whitespace-pre-wrap line-clamp-4">
        {entry.text}
      </p>
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {themes.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      )}
    </button>
  );
}

function InsightCard({ insight, onOpen, saved }) {
  return (
    <button
      onClick={() => onOpen(insight)}
      className="w-full text-left rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 hover:border-indigo-300 transition"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-xs uppercase tracking-wider text-indigo-600 font-medium">
          {insight.type.replace(/_/g, " ")}
        </span>
        <span className="ml-auto text-xs text-stone-500">
          {Math.round(insight.confidence * 100)}%
        </span>
        {saved && <Save className="w-3.5 h-3.5 text-indigo-500" />}
      </div>
      <h3 className="text-[15px] font-medium text-stone-900 mb-1">
        {insight.title}
      </h3>
      <p className="text-[14px] text-stone-700 line-clamp-3">{insight.body}</p>
    </button>
  );
}

function FeedScreen({ state, onOpenEntry, onOpenInsight }) {
  const items = useMemo(() => {
    const visible = state.insights
      .filter((i) => !state.dismissedInsightIds.includes(i.id))
      .map((i) => ({ kind: "insight", at: i.createdAt, data: i }));
    const entries = state.entries.map((e) => ({
      kind: "entry",
      at: e.createdAt,
      data: e,
    }));
    return [...visible, ...entries].sort((a, b) => b.at - a.at);
  }, [state.entries, state.insights, state.dismissedInsightIds]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="text-center max-w-sm">
          <Sparkles className="w-8 h-8 text-stone-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-stone-800 mb-1">
            Nothing captured yet
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Tap the + button and write a fragment of what's on your mind.
            Signal will look for patterns across what you log over time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-32 space-y-3">
      {items.map((it) =>
        it.kind === "insight" ? (
          <InsightCard
            key={`i-${it.data.id}`}
            insight={it.data}
            onOpen={onOpenInsight}
            saved={state.savedInsightIds.includes(it.data.id)}
          />
        ) : (
          <EntryCard
            key={`e-${it.data.id}`}
            entry={it.data}
            onOpen={onOpenEntry}
          />
        )
      )}
    </div>
  );
}

function CaptureScreen({ onCancel, onSubmit, submitting }) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [showMood, setShowMood] = useState(false);

  const moods = ["calm", "anxious", "tired", "energized", "sad", "content"];

  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <button
          onClick={onCancel}
          className="text-stone-500 text-sm px-2 py-1"
          disabled={submitting}
        >
          Cancel
        </button>
        <span className="text-sm font-medium text-stone-700">Capture</span>
        <button
          onClick={() => onSubmit(text.trim(), mood)}
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
        placeholder="What's on your mind right now? A fragment is enough."
        className="flex-1 px-5 py-4 text-[17px] text-stone-800 placeholder:text-stone-400 outline-none resize-none leading-relaxed"
      />
      <div className="border-t border-stone-100 px-4 py-3">
        {!showMood ? (
          <button
            onClick={() => setShowMood(true)}
            className="text-sm text-stone-500"
          >
            + add context
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? null : m)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  mood === m
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EntryDetail({ entry, onBack }) {
  const ex = entry.extraction;
  return (
    <div className="absolute inset-0 bg-stone-50 z-20 flex flex-col">
      <div className="flex items-center px-2 py-3 border-b border-stone-100 bg-white">
        <button
          onClick={onBack}
          className="p-2 text-stone-600 flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="ml-2 text-sm text-stone-500">
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <p className="text-[16px] text-stone-800 whitespace-pre-wrap leading-relaxed">
            {entry.text}
          </p>
          {entry.mood && (
            <div className="mt-3">
              <Pill tone="warm">mood: {entry.mood}</Pill>
            </div>
          )}
        </div>
        {entry.processing === "pending" && (
          <div className="text-sm text-stone-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Extracting…
          </div>
        )}
        {entry.processing === "failed" && (
          <div className="text-sm text-amber-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Extraction failed for this
            entry.
          </div>
        )}
        {ex && (
          <>
            {ex.summary && (
              <Section title="Summary">
                <p className="text-sm text-stone-700">{ex.summary}</p>
              </Section>
            )}
            {ex.themes?.length > 0 && (
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
            {ex.emotions?.length > 0 && (
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
            {ex.entities?.length > 0 && (
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
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InsightDetail({ insight, entries, onBack, onFeedback, feedback }) {
  const evidence = insight.evidence_entry_ids
    .map((id) => entries.find((e) => e.id === id))
    .filter(Boolean);

  const f = feedback[insight.id] || {};

  const FeedbackButton = ({ kind, label, icon: Icon }) => (
    <button
      onClick={() => onFeedback(insight.id, kind)}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
        f[kind]
          ? "bg-stone-900 text-white border-stone-900"
          : "bg-white text-stone-700 border-stone-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="absolute inset-0 bg-stone-50 z-20 flex flex-col">
      <div className="flex items-center px-2 py-3 border-b border-stone-100 bg-white">
        <button
          onClick={onBack}
          className="p-2 text-stone-600 flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs uppercase tracking-wider text-indigo-600 font-medium">
              {insight.type.replace(/_/g, " ")}
            </span>
            <span className="ml-auto text-xs text-stone-500">
              confidence {Math.round(insight.confidence * 100)}%
            </span>
          </div>
          <h2 className="text-lg font-medium text-stone-900 mb-2">
            {insight.title}
          </h2>
          <p className="text-[15px] text-stone-800 leading-relaxed">
            {insight.body}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FeedbackButton kind="accurate" label="Accurate" icon={Check} />
          <FeedbackButton
            kind="partial"
            label="Partially"
            icon={AlertTriangle}
          />
          <FeedbackButton kind="wrong" label="Wrong" icon={X} />
          <FeedbackButton kind="important" label="Important" icon={Sparkles} />
          <FeedbackButton kind="boring" label="Boring" icon={X} />
          <FeedbackButton kind="saved" label="Save" icon={Save} />
        </div>

        <Section title={`Evidence · ${evidence.length} entries`}>
          <div className="space-y-2">
            {evidence.map((e) => (
              <div
                key={e.id}
                className="rounded-xl bg-stone-50 border border-stone-200 p-3"
              >
                <div className="text-[11px] text-stone-500 mb-1">
                  {new Date(e.createdAt).toLocaleString()}
                </div>
                <div className="text-sm text-stone-800 line-clamp-3">
                  {e.text}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function SettingsScreen({ state, onBack, onExport, onClear }) {
  return (
    <div className="absolute inset-0 bg-stone-50 z-20 flex flex-col">
      <div className="flex items-center px-2 py-3 border-b border-stone-100 bg-white">
        <button
          onClick={onBack}
          className="p-2 text-stone-600 flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="ml-2 text-sm font-medium text-stone-700">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Storage
          </div>
          <div className="text-sm text-stone-700">
            {state.entries.length} entries · {state.insights.length} insights
          </div>
          <div className="text-xs text-stone-500">
            Stored locally in this browser. Nothing leaves your device except
            the text you send to Claude during extraction and insight
            generation.
          </div>
        </div>

        <button
          onClick={onExport}
          className="w-full rounded-2xl bg-white border border-stone-200 p-4 flex items-center gap-3 text-left"
        >
          <Download className="w-5 h-5 text-stone-600" />
          <div>
            <div className="text-sm font-medium text-stone-800">
              Export all data
            </div>
            <div className="text-xs text-stone-500">
              Download JSON of every entry, insight, and reaction.
            </div>
          </div>
        </button>

        <button
          onClick={onClear}
          className="w-full rounded-2xl bg-white border border-red-200 p-4 flex items-center gap-3 text-left"
        >
          <Trash2 className="w-5 h-5 text-red-600" />
          <div>
            <div className="text-sm font-medium text-red-700">
              Delete everything
            </div>
            <div className="text-xs text-red-500">
              Wipes local storage. Cannot be undone.
            </div>
          </div>
        </button>

        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <div className="text-xs text-amber-900 leading-relaxed">
            Signal is not therapy and not medical advice. Insights are
            pattern-matches, sometimes wrong, sometimes obvious. Treat them as
            prompts for your own reflection, nothing more.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Signal() {
  const [state, setState] = useState(() => loadState());
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const [view, setView] = useState({ name: "feed" });
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const handleSubmit = useCallback(async (text, mood) => {
    if (!text) return;
    setSubmitting(true);
    setError(null);
    const entry = {
      id: newId(),
      text,
      mood,
      createdAt: Date.now(),
      extraction: null,
      processing: "pending",
    };
    setState((s) => ({ ...s, entries: [...s.entries, entry] }));
    setCapturing(false);
    setSubmitting(false);

    let extracted;
    try {
      extracted = await extractEntry(text, mood);
    } catch (e) {
      setState((s) => ({
        ...s,
        entries: s.entries.map((x) =>
          x.id === entry.id ? { ...x, processing: "failed" } : x
        ),
      }));
      setError(`Extraction failed: ${e.message}`);
      return;
    }
    setState((s) => ({
      ...s,
      entries: s.entries.map((x) =>
        x.id === entry.id
          ? { ...x, extraction: extracted, processing: "done" }
          : x
      ),
    }));

    setGenerating(true);
    try {
      const latest = stateRef.current;
      const entriesWithLatest = latest.entries.map((x) =>
        x.id === entry.id
          ? { ...x, extraction: extracted, processing: "done" }
          : x
      );
      const candidate = await maybeGenerateInsight(
        entriesWithLatest,
        latest.insights,
        latest.dismissedInsightIds
      );
      if (candidate) {
        setState((s) => ({ ...s, insights: [...s.insights, candidate] }));
      }
    } catch (e) {
      setError(`Insight generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleFeedback = useCallback((insightId, kind) => {
    setState((s) => {
      const cur = s.feedback[insightId] || {};
      const next = { ...cur, [kind]: !cur[kind] };
      const feedback = { ...s.feedback, [insightId]: next };
      let dismissedInsightIds = s.dismissedInsightIds;
      let savedInsightIds = s.savedInsightIds;
      if (kind === "wrong" && next.wrong) {
        dismissedInsightIds = [
          ...new Set([...dismissedInsightIds, insightId]),
        ];
      }
      if (kind === "boring" && next.boring) {
        dismissedInsightIds = [
          ...new Set([...dismissedInsightIds, insightId]),
        ];
      }
      if (kind === "saved") {
        savedInsightIds = next.saved
          ? [...new Set([...savedInsightIds, insightId])]
          : savedInsightIds.filter((i) => i !== insightId);
      }
      return { ...s, feedback, dismissedInsightIds, savedInsightIds };
    });
  }, []);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const handleClear = useCallback(() => {
    if (
      !confirm(
        "Delete every entry, insight, and reaction stored in this browser? This cannot be undone."
      )
    )
      return;
    setState(structuredClone(EMPTY_STATE));
    setView({ name: "feed" });
  }, []);

  const openEntry = (entry) => setView({ name: "entry", entry });
  const openInsight = (insight) => setView({ name: "insight", insight });

  return (
    <div className="relative w-full h-full bg-stone-50 text-stone-900 font-sans flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-stone-900 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Signal</h1>
          {generating && (
            <Loader2 className="w-4 h-4 text-stone-400 animate-spin ml-1" />
          )}
        </div>
        <button
          onClick={() => setView({ name: "settings" })}
          className="p-2 text-stone-500 hover:text-stone-700"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </header>

      <FeedScreen
        state={state}
        onOpenEntry={openEntry}
        onOpenInsight={openInsight}
      />

      {error && (
        <div className="absolute bottom-24 left-4 right-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <button
        onClick={() => setCapturing(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-stone-900 text-white shadow-lg flex items-center justify-center hover:bg-stone-800 transition"
      >
        <Plus className="w-6 h-6" />
      </button>

      {capturing && (
        <CaptureScreen
          onCancel={() => setCapturing(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {view.name === "entry" && (
        <EntryDetail
          entry={state.entries.find((e) => e.id === view.entry.id) || view.entry}
          onBack={() => setView({ name: "feed" })}
        />
      )}

      {view.name === "insight" && (
        <InsightDetail
          insight={view.insight}
          entries={state.entries}
          feedback={state.feedback}
          onFeedback={handleFeedback}
          onBack={() => setView({ name: "feed" })}
        />
      )}

      {view.name === "settings" && (
        <SettingsScreen
          state={state}
          onBack={() => setView({ name: "feed" })}
          onExport={handleExport}
          onClear={handleClear}
        />
      )}
    </div>
  );
}
