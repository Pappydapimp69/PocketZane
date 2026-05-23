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
