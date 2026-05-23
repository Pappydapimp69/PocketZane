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
