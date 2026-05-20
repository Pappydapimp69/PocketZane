import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
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
  Pencil,
  Send,
  Eye,
} from "lucide-react";

/* =====================================================================
 *  STORAGE
 * ===================================================================== */

const STORAGE_KEY = "signal_zane_v2";

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
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_STATE);
    return { ...structuredClone(EMPTY_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* =====================================================================
 *  VOICE — Zane
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

/* Seed prompts — used until the user has enough history for Claude-generated.
 * Density tags: SHARP (incisive), SPARSE (1-4 words), NEUTRAL (plain question),
 * CURIOUS (open, exploratory). Mix is roughly 30/40/20/10. */
const SEED_PROMPTS = [
  { density: "NEUTRAL", text: "What's the last thing today that took up more headspace than it deserved?" },
  { density: "SHARP", text: "Tell me about something today you'd narrate differently to different people. Pick the version you'd give the one you trust least." },
  { density: "SPARSE", text: "What did you avoid?" },
  { density: "NEUTRAL", text: "Describe one conversation from today in three sentences." },
  { density: "SHARP", text: "What did you do today that you'd be embarrassed to journal honestly about?" },
  { density: "CURIOUS", text: "What's a small thing someone said this week that's still rattling around?" },
  { density: "SPARSE", text: "Where did today drag?" },
  { density: "SHARP", text: "What's a feeling you've been calling by the wrong name?" },
  { density: "NEUTRAL", text: "What did you want today that you didn't ask for?" },
  { density: "SPARSE", text: "What flinched today?" },
  { density: "CURIOUS", text: "What's a small decision today that felt larger than it should have?" },
  { density: "SHARP", text: "Pick something you were certain about a year ago and now aren't." },
  { density: "NEUTRAL", text: "What's one thing you postponed today?" },
  { density: "SPARSE", text: "Who did you perform for?" },
  { density: "SHARP", text: "What's the laziest sentence you used today and what was it covering for?" },
  { density: "NEUTRAL", text: "Describe the last time today you felt fully present." },
  { density: "CURIOUS", text: "What made you laugh? Really laugh, not the social one." },
  { density: "SPARSE", text: "What did you reread?" },
  { density: "SHARP", text: "What's a story you tell about yourself that's getting harder to believe?" },
  { density: "NEUTRAL", text: "What happened today that you'd want a future version of you to remember?" },
  { density: "SPARSE", text: "What sentence wouldn't you say out loud?" },
  { density: "CURIOUS", text: "What's a small piece of evidence today against something you assume about yourself?" },
  { density: "SHARP", text: "What did you call a choice that was actually a reflex?" },
  { density: "NEUTRAL", text: "Who took up the most room in your head today?" },
  { density: "SPARSE", text: "What surprised you?" },
  { density: "SHARP", text: "What did you do today purely so you could tell someone about it later?" },
  { density: "CURIOUS", text: "What's a feeling today you don't have a good word for?" },
  { density: "NEUTRAL", text: "What did you start? What did you finish?" },
  { density: "SPARSE", text: "What sounded rehearsed?" },
  { density: "SHARP", text: "What did you protect today that maybe didn't need protecting?" },
];

/* =====================================================================
 *  LLM CALLS
 * ===================================================================== */

async function callClaude(prompt) {
  if (typeof window === "undefined" || !window.claude?.complete) {
    throw new Error("window.claude.complete unavailable — run inside a Claude.ai artifact.");
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

  const priorTitles = existingInsights
    .filter((ins) => !dismissedIds.includes(ins.id))
    .slice(-10)
    .map((ins) => `- ${ins.title}`)
    .join("\n") || "(none yet)";

  const correctionsBlock = corrections.length
    ? corrections.slice(-10).map((c) => `- You said "${c.originalText}" — corrected to "${c.userText}"`).join("\n")
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

async function generateNextPrompt(state, justAnsweredEntry) {
  const recent = state.entries.slice(-10);
  const recentBlock = recent
    .map((e) => {
      const ex = e.extraction || {};
      return `- [${new Date(e.createdAt).toLocaleDateString()}] "${e.text}" {themes: ${(ex.themes || []).join(", ")}}`;
    })
    .join("\n");

  const correctionsBlock = state.corrections.length
    ? state.corrections.slice(-8).map((c) => `- You said "${c.originalText}" — corrected to "${c.userText}"`).join("\n")
    : "(none)";

  const lastPromptDensities = state.prompts
    .slice(-5)
    .map((p) => p.density || "?")
    .join(", ");

  const prompt = `You are Zane. The user just answered with: """${justAnsweredEntry.text}"""

Their recent entries:
${recentBlock}

Their corrections of your past interpretations (ground truth):
${correctionsBlock}

Last 5 prompt densities you served (DON'T repeat the same density twice in a row): ${lastPromptDensities}

Generate ONE new prompt for them. Rules:
- 1-2 sentences max, often 4-10 words, sometimes 2-3 words.
- Pick a density: SHARP (incisive), SPARSE (very short, 2-5 words), NEUTRAL (plain ask), CURIOUS (open).
- VARY — alternate densities. Sparse is good and underused. Sharp every time is exhausting.
- Sometimes follow up on what they just answered. Sometimes pivot to something they've been circling.
- Reference specifics from their recent entries when it adds bite.
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
    source: "claude",
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
    source: "callback",
    referencedEntryIds: [recentEntry.id, dormantEntry.id],
    createdAt: Date.now(),
  };
}

/* =====================================================================
 *  STATE ENGINE — OBSERVE / INTERPRET / STRIKE
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
  const recent = entries.filter((e) => now - e.createdAt <= 3 * WEEK / 7); // last ~3 days
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
 *  UI HELPERS
 * ===================================================================== */

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 border-stone-200",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
    warm: "bg-amber-50 text-amber-800 border-amber-200",
    cool: "bg-sky-50 text-sky-700 border-sky-200",
    dark: "bg-stone-900 text-stone-100 border-stone-900",
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}>{children}</span>;
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

/* =====================================================================
 *  SCREENS
 * ===================================================================== */

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

  return (
    <div className="rounded-3xl bg-stone-950 text-stone-100 p-6 space-y-4 shadow-lg">
      <div className="flex items-center gap-2">
        <Eye className="w-3.5 h-3.5 text-stone-500" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Zane</span>
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
    </button>
  );
}

function HomeScreen({ state, currentPrompt, generatingPrompt, onAnswer, onSkipPrompt, onFreeWrite, onOpenEntry, onOpenInsight, onCorrectReceipt }) {
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
          )
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
                <Pill key={t} tone="accent">{t}</Pill>
              ))}
            </div>
          </Section>
        )}
        {ex?.emotions?.length > 0 && (
          <Section title="Emotions">
            <div className="flex flex-wrap gap-1.5">
              {ex.emotions.map((em, i) => (
                <Pill key={i} tone="warm">{em.label} · {em.intensity}/5</Pill>
              ))}
            </div>
          </Section>
        )}
        {ex?.entities?.length > 0 && (
          <Section title="Mentions">
            <div className="flex flex-wrap gap-1.5">
              {ex.entities.map((en, i) => (
                <Pill key={i} tone="cool">{en.name}<span className="opacity-50"> · {en.type}</span></Pill>
              ))}
            </div>
          </Section>
        )}
        {ex?.verbatim_phrases?.length > 0 && (
          <Section title="Phrases tracked">
            <div className="flex flex-wrap gap-1.5">
              {ex.verbatim_phrases.map((p, i) => (
                <Pill key={i} tone="dark">"{p}"</Pill>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function InsightDetail({ insight, entries, onBack, onFeedback, feedback }) {
  const evidence = insight.evidence_entry_ids.map((id) => entries.find((e) => e.id === id)).filter(Boolean);
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
            <span className="ml-auto text-[11px] text-stone-500">confidence {Math.round(insight.confidence * 100)}%</span>
          </div>
          <h2 className="text-lg font-medium text-stone-900 mb-2">{insight.title}</h2>
          <p className="text-[15px] text-stone-800 leading-relaxed">{insight.body}</p>
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
                <div className="text-[11px] text-stone-500 mb-1">{new Date(e.createdAt).toLocaleString()}</div>
                <div className="text-sm text-stone-800 line-clamp-3">{e.text}</div>
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
            Not a friend, not a therapist, not a coach. He notices what you write. He'll be wrong sometimes. Correct him when he is.
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Storage</div>
          <div className="text-sm text-stone-700">
            {state.entries.length} entries · {state.insights.length} insights · {state.corrections.length} corrections
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Stored locally in this browser. Text leaves the device only to be sent to the AI model.
          </div>
        </div>
        <button onClick={onExport} className="w-full rounded-2xl bg-white border border-stone-200 p-4 flex items-center gap-3 text-left">
          <Download className="w-5 h-5 text-stone-600" />
          <div>
            <div className="text-sm font-medium text-stone-800">Export all data</div>
            <div className="text-xs text-stone-500">JSON of every entry, prompt, insight, correction.</div>
          </div>
        </button>
        <button onClick={onClear} className="w-full rounded-2xl bg-white border border-red-200 p-4 flex items-center gap-3 text-left">
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

/* =====================================================================
 *  MAIN
 * ===================================================================== */

export default function Signal() {
  const [state, setState] = useState(() => loadState());
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
    [state.prompts, state.currentPromptId]
  );

  /* Ensure there's always a prompt available */
  const ensurePrompt = useCallback(async () => {
    const s = stateRef.current;
    if (s.currentPromptId) return;
    if (s.entries.length < 5) {
      const used = new Set(s.prompts.map((p) => p.text));
      const pool = SEED_PROMPTS.filter((p) => !used.has(p.text));
      const pick = (pool.length ? pool : SEED_PROMPTS)[Math.floor(Math.random() * (pool.length || SEED_PROMPTS.length))];
      const newP = {
        id: newId(),
        text: pick.text,
        density: pick.density,
        source: "seed",
        createdAt: Date.now(),
      };
      setState((st) => ({ ...st, prompts: [...st.prompts, newP], currentPromptId: newP.id }));
      return;
    }
    setGeneratingPrompt(true);
    try {
      const callback = Math.random() < 0.35 ? findDormantCallback(s.entries) : null;
      let np = null;
      if (callback) {
        np = await generateCallbackPrompt(callback.recent, callback.dormant);
      }
      if (!np) {
        np = await generateNextPrompt(s, s.entries[s.entries.length - 1]);
      }
      if (np) {
        setState((st) => ({ ...st, prompts: [...st.prompts, np], currentPromptId: np.id }));
      } else {
        const pick = SEED_PROMPTS[Math.floor(Math.random() * SEED_PROMPTS.length)];
        const fallback = { id: newId(), text: pick.text, density: pick.density, source: "seed", createdAt: Date.now() };
        setState((st) => ({ ...st, prompts: [...st.prompts, fallback], currentPromptId: fallback.id }));
      }
    } catch (e) {
      setError(`Prompt generation failed: ${e.message}`);
    } finally {
      setGeneratingPrompt(false);
    }
  }, []);

  useEffect(() => {
    if (state.onboarded && !state.currentPromptId) {
      ensurePrompt();
    }
  }, [state.onboarded, state.currentPromptId, ensurePrompt]);

  const handleAnswer = useCallback(
    async (text, options = {}) => {
      if (!text) return;
      const promptForAnswer = options.freeWrite ? null : currentPrompt;
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
          x.id === entry.id ? { ...x, extraction: extracted, processing: "done" } : x
        ),
      }));

      if (zaneState === "INTERPRET" || zaneState === "STRIKE") {
        try {
          const receipt = await generateReceipt(
            { ...entry, extraction: extracted },
            stateRef.current.corrections
          );
          if (receipt) {
            setState((s) => ({
              ...s,
              entries: s.entries.map((x) => (x.id === entry.id ? { ...x, receipt } : x)),
            }));
          }
        } catch (e) {
          /* receipt failures are silent */
        }
      }

      if (zaneState === "STRIKE") {
        try {
          const latest = stateRef.current;
          const withCurrent = latest.entries.map((x) =>
            x.id === entry.id ? { ...x, extraction: extracted } : x
          );
          const candidate = await maybeGenerateInsight(
            withCurrent,
            latest.insights,
            latest.dismissedInsightIds,
            latest.corrections
          );
          if (candidate) {
            setState((s) => ({ ...s, insights: [...s.insights, candidate] }));
          }
        } catch (e) {
          /* strike failures are silent */
        }
      }

      if (!options.freeWrite) {
        ensurePrompt();
      }
    },
    [currentPrompt, ensurePrompt]
  );

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
      return {
        ...s,
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, receipt: { ...e.receipt, correctedTo: correctionText } } : e
        ),
        corrections: [...s.corrections, correction],
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
      if ((kind === "wrong" || kind === "boring") && next[kind]) {
        dismissedInsightIds = [...new Set([...dismissedInsightIds, insightId])];
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
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const handleClear = useCallback(() => {
    if (!confirm("Delete every entry, prompt, insight, and correction stored in this browser? This cannot be undone."))
      return;
    setState(structuredClone(EMPTY_STATE));
    setView({ name: "home" });
  }, []);

  if (!state.onboarded) {
    return (
      <div className="relative w-full h-full bg-stone-50 text-stone-900 font-sans flex flex-col overflow-hidden">
        <OnboardingScreen onDone={() => setState((s) => ({ ...s, onboarded: true }))} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-stone-50 text-stone-900 font-sans flex flex-col overflow-hidden">
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
        <div className="absolute bottom-6 left-4 right-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl flex items-start gap-2">
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
          insight={view.insight}
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
          onClear={handleClear}
        />
      )}
    </div>
  );
}
