// ==UserScript==
// @name         ElevenLabs Studio — Label Voice Assigner
// @namespace    https://github.com/pappydapimp69/pocketzane
// @version      0.3.0
// @description  Paste labeled, header-mapped text into ElevenLabs Studio; strip the labels, insert the clean text, and bulk-assign voices per role (voice-by-voice multi-select).
// @match        https://elevenlabs.io/app/studio/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        unsafeWindow
// ==/UserScript==

/*
 * HOW IT WORKS (see repo plan for the full design)
 *
 * Paste text shaped like this into the popup:
 *
 *     1 = host, zane
 *     2 = host, shane
 *     3 = narrator
 *     4 = ad read, ad voice
 *
 *     1 Aaand we're back. Welcome to the show.
 *     2 This is the one you've been threatening to do for a year.
 *     1 I have been PREPARING, okay?
 *     3 Today, one topic. Japan.
 *
 * - The HEADER (top block, until the first blank line) maps each label to a
 *   role and, optionally, a voice. A lone field is ALWAYS the role/title; a
 *   voice only ever appears as the second comma field. So `3 = narrator` is a
 *   role with no voice yet -> you get prompted "Pick a voice for narrator".
 * - The BODY: each paragraph starts with a label token; the script strips it.
 * - The script inserts the clean text into the editor, then assigns voices in
 *   bulk, one action per distinct voice (multi-select + the voice control).
 *
 * The voice picker DOM is read live at assign time. The CONFIG block below
 * holds the selectors / tunables that may need calibration on first live run.
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // CONFIG — tweak here if the page markup shifts (calibrated on first live run)
  // ----------------------------------------------------------------------------
  const CONFIG = {
    debug: true,

    // The TipTap/ProseMirror editable surface.
    editorSelector: '.tiptap.ProseMirror, [data-agent-role="tiptap-input"]',

    // One TTS chunk ("node") per paragraph.
    nodeSelector: '[data-isttsnode="true"]',
    nodeSelectorFallback: '.tts-node',

    // The little per-node round voice control to the left of each paragraph.
    // Its data-agent-id is `voice-indicator-<voiceId>` and aria-label is
    // `Select <voice name>`. Clicking it opens the voice picker.
    voiceIndicatorSelector: '[data-agent-id^="voice-indicator-"]:not([data-agent-id^="voice-indicator-mobile-"])',
    voiceIndicatorAny: '[data-agent-id^="voice-indicator-"]',

    // How body paragraphs are separated. 'line' = one node per non-empty line
    // (default, matches the observed Studio paste behavior); 'blank' = split on
    // blank lines.
    paragraphSplit: 'line',

    // Timing (ms).
    pickerOpenTimeout: 4000,
    pickerPoll: 60,
    betweenClicks: 70,
    afterPaste: 1200,

    // Heuristics for locating the open voice picker + its rows. These are
    // intentionally broad; the picker is a transient popover so we look for the
    // most-recently-shown listbox/menu/dialog that is NOT the editor.
    pickerContainerSelectors: [
      '[role="listbox"]',
      '[role="menu"]',
      '[data-radix-popper-content-wrapper]',
      '[role="dialog"]',
    ],
    pickerRowSelectors: [
      '[role="option"]',
      '[role="menuitem"]',
      'button',
      'li',
      'a',
    ],
  };

  const SS = '__elabVoiceAssigner';
  if (window[SS]) return; // guard against double-injection
  window[SS] = true;

  // ----------------------------------------------------------------------------
  // debug capture — every log is mirrored into a ring buffer + a structured
  // run report, surfaced in the popup's Debug tab ("Copy debug" -> paste to me).
  // ----------------------------------------------------------------------------
  const RUN = {
    log: [],          // [{ t, level, msg }]
    report: null,     // structured summary of the latest run
    pickerSnapshot: null,
    lastIndicatorHTML: null,      // last voice-indicator we clicked (capture-on-failure)
    lastPopoverCandidates: null,  // visible popover-like nodes after a failed open
    lastPlan: null,
    lastLabelVoice: null,
    maxLog: 3000,
  };
  let dbgEl = null;   // the Debug tab <textarea>, when the modal is open
  function refreshDebugTab() {
    if (dbgEl && dbgEl.isConnected) dbgEl.value = buildDebugBlob();
  }
  function stringifyArg(a) {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (_) { return String(a); }
  }
  function rec(level, args) {
    RUN.log.push({ t: Date.now(), level, msg: args.map(stringifyArg).join(' ') });
    if (RUN.log.length > RUN.maxLog) RUN.log.splice(0, RUN.log.length - RUN.maxLog);
    refreshDebugTab();
  }
  const log = (...a) => { if (CONFIG.debug) console.log('[voice-assign]', ...a); rec('log', a); };
  const warn = (...a) => { console.warn('[voice-assign]', ...a); rec('warn', a); };

  // ----------------------------------------------------------------------------
  // small utils
  // ----------------------------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  async function waitFor(fn, { timeout = 3000, poll = 50 } = {}) {
    const start = Date.now();
    for (;;) {
      let v;
      try { v = fn(); } catch (_) { v = null; }
      if (v) return v;
      if (Date.now() - start > timeout) return null;
      await sleep(poll);
    }
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  }

  // The page's REAL Window. Under a Tampermonkey @grant sandbox, the script's
  // `window` is a wrapper that Chrome's PointerEvent constructor refuses to
  // accept as `view` ("Failed to convert value to 'Window'"). unsafeWindow (or
  // document.defaultView) is the genuine Window the event constructors expect.
  const REAL_WINDOW =
    (typeof unsafeWindow !== 'undefined' && unsafeWindow) || document.defaultView || window;

  // Construct an event, falling back to omitting `view` if the constructor still
  // rejects it — so a bad `view` can never kill the click sequence.
  function mkEvent(Ctor, type, opts) {
    try {
      return new Ctor(type, opts);
    } catch (_) {
      const { view, ...rest } = opts;
      return new Ctor(type, rest);
    }
  }

  // Dispatch a realistic click (optionally with the ctrl/cmd modifier for
  // multi-select). Some editors only honor the modifier on mousedown, so we set
  // it on the whole pointer/mouse sequence.
  async function realClick(el, { multi = false } = {}) {
    if (!el) return false;
    const target = deepestClickable(el);
    const rect = target.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: REAL_WINDOW,
      clientX: Math.floor(rect.left + rect.width / 2),
      clientY: Math.floor(rect.top + rect.height / 2),
      ctrlKey: multi,
      metaKey: multi,
    };
    target.dispatchEvent(mkEvent(PointerEvent, 'pointerdown', opts));
    target.dispatchEvent(mkEvent(MouseEvent, 'mousedown', opts));
    target.dispatchEvent(mkEvent(PointerEvent, 'pointerup', opts));
    target.dispatchEvent(mkEvent(MouseEvent, 'mouseup', opts));
    target.dispatchEvent(mkEvent(MouseEvent, 'click', opts));
    await sleep(CONFIG.betweenClicks);
    return true;
  }

  // Click the node's deepest text-bearing element, to mirror a real user click.
  function deepestClickable(el) {
    let cur = el;
    while (cur && cur.children && cur.children.length === 1 && cur.firstElementChild) {
      cur = cur.firstElementChild;
    }
    return cur || el;
  }

  // Compact, log-friendly description of an element: tag, role, data-* and a
  // short HTML preview. Used to surface picker markup even when detection fails.
  function describeEl(el, htmlChars = 200) {
    if (!el) return '(null)';
    const attrs = [];
    for (const a of el.attributes || []) {
      if (a.name === 'role' || a.name === 'class' || a.name.startsWith('data-') || a.name.startsWith('aria-')) {
        attrs.push(`${a.name}="${(a.value || '').slice(0, 60)}"`);
      }
    }
    const html = (el.outerHTML || '').replace(/\s+/g, ' ').trim().slice(0, htmlChars);
    return `<${el.tagName.toLowerCase()} ${attrs.join(' ')}> visible=${isVisible(el)} | ${html}`;
  }

  // All elements currently matching the broad picker-container selectors.
  function allPickerContainers() {
    return [...document.querySelectorAll(CONFIG.pickerContainerSelectors.join(','))];
  }

  // ----------------------------------------------------------------------------
  // parsing  (pure functions — the testable core)
  // ----------------------------------------------------------------------------

  // Parse the header block. Returns { map: {label -> {title, voice|null}},
  // bodyText, order: [labels...] }.
  // Header is the run of leading lines matching `LABEL = ...`, ending at the
  // first blank line or first non-matching line.
  function parseHeader(raw) {
    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const map = {};
    const order = [];
    let i = 0;
    const headerLine = /^\s*([^=\n]+?)\s*=\s*(.*)$/;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') { i++; break; } // blank line ends the header
      const m = headerLine.exec(line);
      if (!m) break; // first non-matching line ends the header
      const label = m[1].trim();
      const rhs = m[2].trim();
      // Split rhs on the FIRST comma: "title, voice". A lone field is the role.
      let title, voice;
      const ci = rhs.indexOf(',');
      if (ci === -1) {
        title = rhs;
        voice = null; // role with no voice yet
      } else {
        title = rhs.slice(0, ci).trim();
        voice = rhs.slice(ci + 1).trim();
        if (voice === '') voice = null;
      }
      if (label && !(label in map)) order.push(label);
      map[label] = { title: title || label, voice };
    }
    const bodyText = lines.slice(i).join('\n');
    return { map, order, bodyText };
  }

  // Split body into paragraphs and strip the leading label token from each.
  // Returns [{ label, text }] in document order. Unlabeled paragraphs get
  // label:null.
  function parseBody(bodyText, labelSet) {
    const blocks =
      CONFIG.paragraphSplit === 'blank'
        ? bodyText.split(/\n\s*\n/)
        : bodyText.split(/\n/);
    const out = [];
    for (const block of blocks) {
      if (block.trim() === '') continue;
      out.push(stripLeadingLabel(block, labelSet));
    }
    return out;
  }

  // From "1 Hello" / "1. Hello" / "1) Hello" / "1| Hello" / "1: Hello" pull the
  // leading label if it's a known label, returning { label, text }.
  function stripLeadingLabel(paragraph, labelSet) {
    const m = /^(\s*)(\S+?)\s*([)\].:|>-]?)\s+([\s\S]*)$/.exec(paragraph);
    if (m) {
      const token = m[2];
      if (labelSet.has(token)) {
        return { label: token, text: m[4] };
      }
    }
    // Also handle a paragraph that is ONLY a label + immediate punctuation, or a
    // label glued to text with punctuation (e.g. "1.Hello").
    const m2 = /^(\s*)(\S+?)([)\].:|>-])\s*([\s\S]*)$/.exec(paragraph);
    if (m2 && labelSet.has(m2[2])) {
      return { label: m2[2], text: m2[4] };
    }
    return { label: null, text: paragraph.trim() };
  }

  // Build the ordered voice plan + the cleaned text, given parsed header & body.
  function buildPlan(header, paras) {
    const plan = []; // [{ index, label, title, voice|null, missing:bool }]
    const cleanParas = [];
    paras.forEach((p, index) => {
      const def = p.label != null ? header.map[p.label] : null;
      plan.push({
        index,
        label: p.label,
        title: def ? def.title : p.label,
        voice: def ? def.voice : null,
        missing: p.label != null && !def, // label used in body but not in header
        unlabeled: p.label == null,
      });
      cleanParas.push(p.text);
    });
    const joiner = CONFIG.paragraphSplit === 'blank' ? '\n\n' : '\n';
    return { plan, cleanText: cleanParas.join(joiner) };
  }

  // ----------------------------------------------------------------------------
  // voices: discover what's available, and resolve names -> clickable voices
  // ----------------------------------------------------------------------------

  // Seed from voices already present on nodes (instant, no clicks).
  function seedVoicesFromNodes() {
    const seen = new Map(); // normName -> { name, id }
    document.querySelectorAll(CONFIG.voiceIndicatorAny).forEach((btn) => {
      const id = (btn.getAttribute('data-agent-id') || '').replace(
        /^voice-indicator-(mobile-)?/,
        ''
      );
      const label = btn.getAttribute('aria-label') || '';
      const name = label.replace(/^\s*Select\s+/i, '').trim();
      if (name && !seen.has(norm(name))) seen.set(norm(name), { name, id });
    });
    return [...seen.values()];
  }

  // A voice token the user clearly didn't fill in: bracket/brace/angle-wrapped
  // (`[voice]`, `<name>`, `{x}`) or a bare placeholder word. We must NOT trust
  // these — feeding them to the picker is what crashed a prior run. Treat them
  // as "needs a real choice" and route to the fixup dropdown.
  function isPlaceholderVoice(v) {
    const s = (v || '').trim();
    if (!s) return true;
    if (/^[[({<].*[\])}>]$/.test(s)) return true;       // wrapped in brackets
    if (/[[\]{}<>]/.test(s)) return true;               // stray bracket chars
    if (/^(voice|voicename|name|tbd|todo|xxx+|\?+)$/i.test(s)) return true;
    return false;
  }

  // Resolve a header voice name against a list of {name} voices.
  // Returns { status: 'ok'|'none'|'ambiguous', match?, candidates? }.
  function resolveVoiceName(name, voices) {
    const n = norm(name);
    if (!n) return { status: 'none' };
    const exact = voices.filter((v) => norm(v.name) === n);
    if (exact.length === 1) return { status: 'ok', match: exact[0] };
    if (exact.length > 1) return { status: 'ambiguous', candidates: exact };
    const starts = voices.filter((v) => norm(v.name).startsWith(n));
    if (starts.length === 1) return { status: 'ok', match: starts[0] };
    const incl = voices.filter((v) => norm(v.name).includes(n));
    if (incl.length === 1) return { status: 'ok', match: incl[0] };
    if (incl.length > 1) return { status: 'ambiguous', candidates: incl };
    return { status: 'none' };
  }

  // ----------------------------------------------------------------------------
  // editor insertion
  // ----------------------------------------------------------------------------
  function getEditor() {
    return document.querySelector(CONFIG.editorSelector);
  }
  function countNodes() {
    return getNodes().length;
  }
  function getNodes() {
    let list = document.querySelectorAll(CONFIG.nodeSelector);
    if (!list.length) list = document.querySelectorAll(CONFIG.nodeSelectorFallback);
    return [...list];
  }

  // Nodes aligned to the plan. If the editor holds MORE nodes than the plan
  // (e.g. a stale node survived the clear), the ones our paste created are the
  // TRAILING `planLength` nodes — so we drive/verify those, not the leading
  // residue, keeping plan[i] ↔ node[i] aligned.
  function getPlanNodes(planLength) {
    const nodes = getNodes();
    if (planLength > 0 && nodes.length > planLength) {
      return nodes.slice(nodes.length - planLength);
    }
    return nodes;
  }

  async function insertIntoEditor(text) {
    const editor = getEditor();
    if (!editor) {
      warn('editor not found:', CONFIG.editorSelector);
      return false;
    }
    editor.focus();
    // Clear existing content. Retry once — a single selectAll+delete sometimes
    // leaves residual default nodes, which would shift node↔plan alignment.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      } catch (_) {}
      await sleep(80);
      if (countNodes() === 0) break;
    }

    const before = countNodes();
    if (before > 0) log('clear: editor still has', before, 'node(s) after clear; will align to trailing nodes');

    // Primary: synthetic paste, so we reuse Studio's own paragraph-splitting.
    let pasted = false;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const evt = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      editor.dispatchEvent(evt);
      pasted = true;
    } catch (e) {
      warn('synthetic paste failed, will try execCommand', e);
    }

    await sleep(CONFIG.afterPaste);

    // Fallback: insertText (also handled by ProseMirror).
    if (countNodes() <= before) {
      log('paste produced no new nodes; trying execCommand insertText');
      try {
        editor.focus();
        document.execCommand('insertText', false, text);
      } catch (e) {
        warn('execCommand insertText failed', e);
      }
      await sleep(CONFIG.afterPaste);
    }

    const after = countNodes();
    log('insert: nodes', before, '->', after, '(pasted:', pasted + ')');
    return after > 0;
  }

  // ----------------------------------------------------------------------------
  // voice picker driving
  // ----------------------------------------------------------------------------

  // Open the picker from a given node's voice-indicator, scrape rows as
  // { name, el }, then (optionally) leave it open. Best-effort + heuristic.
  async function openPickerFor(node) {
    const wrapper = node.closest('.react-renderer') || node.closest('[data-node-view-wrapper]') || node.parentElement;
    let indicator =
      (wrapper && wrapper.querySelector(CONFIG.voiceIndicatorSelector)) ||
      (wrapper && wrapper.querySelector(CONFIG.voiceIndicatorAny));
    if (!indicator) {
      // As a fallback use any visible indicator on the page.
      indicator = [...document.querySelectorAll(CONFIG.voiceIndicatorSelector)].find(isVisible);
    }
    if (!indicator) {
      warn('no voice indicator found to open the picker');
      return null;
    }
    log('picker: using indicator', describeEl(indicator, 0));

    // Track VISIBILITY, not mere existence: Radix/ElevenLabs popovers are often
    // pre-rendered hidden and just toggled visible, so a container that existed
    // (hidden) before the click is still the freshly-opened picker. We snapshot
    // which containers were *visible* before, then accept any that became visible.
    const visibleBefore = new Set(allPickerContainers().filter(isVisible));
    log('picker: containers before click —', `total=${allPickerContainers().length}`, `visible=${visibleBefore.size}`);

    await realClick(indicator);

    const container = await waitFor(
      () => {
        const fresh = allPickerContainers().filter((el) => isVisible(el) && !visibleBefore.has(el));
        return fresh.length ? fresh[fresh.length - 1] : null;
      },
      { timeout: CONFIG.pickerOpenTimeout, poll: CONFIG.pickerPoll }
    );

    if (!container) {
      // Capture-on-failure: dump whatever popover-like markup is visible now so
      // the next debug blob carries actionable picker DOM even though detection
      // missed it. (See snapshotPickerDOM for the persisted version.)
      const after = allPickerContainers();
      const visibleNow = after.filter(isVisible);
      warn('picker did not open / not detected;', `containers now total=${after.length} visible=${visibleNow.length}`);
      visibleNow.slice(-5).forEach((el, i) => warn(`  candidate[${i}]`, describeEl(el)));
      RUN.lastIndicatorHTML = indicator.outerHTML;
      RUN.lastPopoverCandidates = visibleNow.slice(-5).map((el) => el.outerHTML);
      return null;
    }
    log('picker: opened', describeEl(container, 0));
    return container;
  }

  function scrapePickerRows(container) {
    const rows = [];
    const seen = new Set();
    for (const sel of CONFIG.pickerRowSelectors) {
      container.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        // Prefer an explicit name from aria-label / img alt, else trimmed text.
        let name =
          el.getAttribute('aria-label') ||
          (el.querySelector('img[alt]') && el.querySelector('img[alt]').getAttribute('alt')) ||
          el.textContent ||
          '';
        name = name.replace(/^\s*Select\s+/i, '').trim();
        // Keep it to a single line / reasonable length (rows, not paragraphs).
        if (!name || name.length > 80 || name.includes('\n')) return;
        seen.add(el);
        rows.push({ name, el });
      });
      if (rows.length) break; // first selector that yields rows wins
    }
    return rows;
  }

  async function closePicker() {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await sleep(CONFIG.betweenClicks);
  }

  // Full available-voice list = node seed first, picker scrape as needed.
  async function discoverVoices() {
    const seed = seedVoicesFromNodes();
    log('seed voices from nodes:', seed.map((v) => v.name));
    return seed;
  }

  async function scrapeAllVoicesViaPicker() {
    const nodes = getNodes();
    if (!nodes.length) return [];
    const container = await openPickerFor(nodes[0]);
    if (!container) return [];
    const rows = scrapePickerRows(container);
    await closePicker();
    const seen = new Map();
    rows.forEach((r) => {
      if (!seen.has(norm(r.name))) seen.set(norm(r.name), { name: r.name });
    });
    const list = [...seen.values()];
    log('scraped voices via picker:', list.map((v) => v.name));
    return list;
  }

  // ----------------------------------------------------------------------------
  // assignment
  // ----------------------------------------------------------------------------

  // Select a group of node elements (plain-click first to reset, ctrl/cmd-click
  // the rest), then open the picker and click the row matching voiceName.
  async function assignVoiceToNodes(nodeEls, voiceName) {
    if (!nodeEls.length) return false;
    await realClick(nodeEls[0]); // plain click clears prior selection
    for (let i = 1; i < nodeEls.length; i++) {
      await realClick(nodeEls[i], { multi: true });
    }
    const container = await openPickerFor(nodeEls[0]);
    if (!container) return false;
    const rows = scrapePickerRows(container);
    const res = resolveVoiceName(voiceName, rows);
    if (res.status !== 'ok') {
      warn(`could not find picker row for "${voiceName}" (${res.status})`, rows.map((r) => r.name));
      await closePicker();
      return false;
    }
    await realClick(res.match.el);
    await sleep(CONFIG.betweenClicks);
    return true;
  }

  async function runAssignment(plan, labelVoice) {
    const total = getNodes().length;
    const nodes = getPlanNodes(plan.length);
    if (total !== plan.length) {
      warn(`node count (${total}) != plan length (${plan.length}); aligning to ${nodes.length} trailing node(s)`);
    }
    // Group node indices by resolved voice name.
    const groups = new Map(); // voiceName -> [nodeEl]
    const n = Math.min(nodes.length, plan.length);
    for (let i = 0; i < n; i++) {
      const voice = labelVoice.get(plan[i].label);
      if (!voice) continue; // unresolved -> skip (was surfaced in fixup)
      if (!groups.has(voice)) groups.set(voice, []);
      groups.get(voice).push(nodes[i]);
    }
    let ok = 0;
    for (const [voice, els] of groups) {
      log(`assigning "${voice}" to ${els.length} node(s)`);
      const done = await assignVoiceToNodes(els, voice);
      if (done) ok++;
      await sleep(CONFIG.betweenClicks);
    }
    return { groups: groups.size, ok };
  }

  // ----------------------------------------------------------------------------
  // self-grading / verification
  // ----------------------------------------------------------------------------

  // name -> voiceId, derived from whatever voices are currently on nodes.
  function voiceIdByNameFromNodes() {
    const m = new Map();
    document.querySelectorAll(CONFIG.voiceIndicatorAny).forEach((btn) => {
      const id = (btn.getAttribute('data-agent-id') || '').replace(/^voice-indicator-(mobile-)?/, '');
      const name = (btn.getAttribute('aria-label') || '').replace(/^\s*Select\s+/i, '').trim();
      if (name && id && !m.has(norm(name))) m.set(norm(name), id);
    });
    return m;
  }

  // Re-read each node's data-voiceid and grade it against the plan. Works even
  // when we don't know the target voiceIds: checks per-group uniformity and
  // cross-group distinctness; checks exact id when the name is known on a node.
  function verifyAssignment(plan, labelVoice) {
    const totalNodes = getNodes().length;
    const nodes = getPlanNodes(plan.length); // verify the nodes we actually drove
    const ids = nodes.map((nd) => nd.getAttribute('data-voiceid') || null);
    const n = Math.min(nodes.length, plan.length);
    const nameId = voiceIdByNameFromNodes();
    const DEFAULT = '21m00Tcm4TlvDq8ikWAM'; // Rachel = Studio default

    const groups = new Map(); // voiceName -> [nodeIndex]
    for (let i = 0; i < n; i++) {
      const v = labelVoice && labelVoice.get(plan[i].label);
      if (!v) continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(i);
    }

    const perGroup = [];
    let pass = 0, total = 0;
    for (const [voice, idxs] of groups) {
      const got = idxs.map((i) => ids[i]);
      const uniform = new Set(got).size === 1;
      const expectedId = nameId.get(norm(voice)) || null;
      const matchesId = expectedId ? got.every((g) => g === expectedId) : null;
      const stillDefault = got.every((g) => g === DEFAULT);
      const ok = uniform && matchesId !== false && !stillDefault;
      perGroup.push({ voice, nodes: idxs.length, uniform, voiceId: got[0], expectedId, matchesId, stillDefault, ok });
      total++; if (ok) pass++;
    }
    const groupIds = perGroup.map((g) => g.voiceId);
    const distinctAcrossGroups = new Set(groupIds).size === groupIds.length;

    return {
      nodeCount: totalNodes,
      alignedNodeCount: nodes.length,
      planLength: plan.length,
      countsMatch: totalNodes === plan.length,
      distinctVoiceIds: [...new Set(ids.filter(Boolean))],
      perGroup,
      distinctAcrossGroups,
      score: total ? `${pass}/${total}` : 'n/a',
      pass, total,
    };
  }

  // Open the voice picker, capture its container outerHTML + scraped rows, close
  // it. Lets us grab the elusive picker markup with one click.
  async function snapshotPickerDOM() {
    const nodes = getNodes();
    if (!nodes.length) { warn('snapshot: no nodes to open a picker from'); return null; }
    const container = await openPickerFor(nodes[0]);
    if (!container) {
      // Capture-on-failure: openPickerFor stashed the indicator + visible
      // popover candidates. Persist them so Copy debug still carries markup.
      warn('snapshot: picker did not open — capturing indicator + visible candidates instead');
      const candidates = RUN.lastPopoverCandidates || [];
      RUN.pickerSnapshot = {
        opened: false,
        rows: [],
        indicatorHTML: RUN.lastIndicatorHTML || null,
        candidates,
        html: candidates.join('\n\n---\n\n'),
      };
      await closePicker();
      refreshDebugTab();
      return RUN.pickerSnapshot;
    }
    const rows = scrapePickerRows(container);
    const html = container.outerHTML;
    log('PICKER SNAPSHOT rows:', rows.map((r) => r.name));
    log('PICKER SNAPSHOT html length:', html.length);
    RUN.pickerSnapshot = { opened: true, rows: rows.map((r) => r.name), html };
    await closePicker();
    refreshDebugTab();
    return RUN.pickerSnapshot;
  }

  function buildDebugBlob() {
    const lines = [];
    lines.push('=== ElevenLabs Voice Assigner — debug ===');
    lines.push('url: ' + location.href);
    lines.push('time: ' + new Date().toISOString());
    lines.push('userAgent: ' + navigator.userAgent);
    lines.push('');
    lines.push('--- run report ---');
    lines.push(JSON.stringify(RUN.report, null, 2));
    if (RUN.pickerSnapshot) {
      const snap = RUN.pickerSnapshot;
      lines.push('');
      lines.push('--- picker snapshot (opened: ' + (snap.opened !== false) + ') ---');
      lines.push('row names: ' + JSON.stringify(snap.rows || [], null, 2));
      if (snap.opened === false) {
        lines.push('--- picker snapshot: indicator outerHTML (open FAILED) ---');
        lines.push(snap.indicatorHTML || '(none captured)');
        lines.push('--- picker snapshot: visible popover candidates (open FAILED) ---');
        lines.push((snap.candidates && snap.candidates.length) ? snap.html : '(none captured)');
      } else {
        lines.push('--- picker snapshot: outerHTML ---');
        lines.push(snap.html);
      }
    }
    lines.push('');
    lines.push('--- log (' + RUN.log.length + ' entries) ---');
    RUN.log.forEach((e) => lines.push(`[${e.level}] ${e.msg}`));
    return lines.join('\n');
  }

  // ----------------------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------------------
  const Z = 2147483000;

  function el(tag, props = {}, kids = []) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'style') Object.assign(e.style, v);
      else if (k === 'class') e.className = v;
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : [kids]).forEach((c) =>
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    );
    return e;
  }

  const baseBtn = {
    cursor: 'pointer',
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: '8px',
    padding: '8px 12px',
    font: '500 13px/1.2 Inter, system-ui, sans-serif',
    background: '#111',
    color: '#fff',
  };

  function injectLauncher() {
    if (document.getElementById('elab-va-launch')) return;
    const btn = el(
      'button',
      {
        id: 'elab-va-launch',
        title: 'Label Voice Assigner',
        style: {
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: String(Z),
          ...baseBtn,
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        },
      },
      '🎙 Voices'
    );
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  function openModal() {
    // If a (possibly minimized) modal already exists, just re-show it with all
    // state intact — clicking off minimizes, it does not reset.
    const existing = document.getElementById('elab-va-overlay');
    if (existing) {
      existing.style.display = 'flex';
      const inp = existing.querySelector('#elab-va-input');
      if (inp) inp.focus();
      return;
    }
    const overlay = el('div', {
      id: 'elab-va-overlay',
      style: {
        position: 'fixed', inset: '0', zIndex: String(Z + 1),
        background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      },
    });
    // Click-off → minimize (keep state), not close+reset.
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) minimizeModal(); });

    const panel = el('div', {
      style: {
        width: 'min(720px, 92vw)', maxHeight: '88vh', overflow: 'auto',
        background: '#fff', color: '#111', borderRadius: '14px',
        padding: '18px', boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
        font: '400 13px/1.45 Inter, system-ui, sans-serif',
      },
    });

    const title = el('div', { style: { font: '600 16px/1.2 Inter, system-ui, sans-serif', marginBottom: '6px' } }, 'Label Voice Assigner');

    // tab bar
    const tabRun = el('button', { style: tabStyle(true) }, 'Run');
    const tabDbg = el('button', { style: tabStyle(false) }, 'Debug');
    const tabs = el('div', { style: { display: 'flex', gap: '6px', margin: '4px 0 12px' } }, [tabRun, tabDbg]);
    const runView = el('div', {});
    const dbgView = el('div', { style: { display: 'none' } });
    function showTab(which) {
      const onRun = which === 'run';
      runView.style.display = onRun ? '' : 'none';
      dbgView.style.display = onRun ? 'none' : '';
      Object.assign(tabRun.style, tabStyle(onRun));
      Object.assign(tabDbg.style, tabStyle(!onRun));
      if (!onRun) refreshDebugTab();
    }
    tabRun.addEventListener('click', () => showTab('run'));
    tabDbg.addEventListener('click', () => showTab('debug'));

    const help = el('div', { style: { color: '#555', marginBottom: '10px' } },
      'Paste header + labeled text. Header lines: "1 = host, zane" (role, voice) or "3 = narrator" (role, voice prompted). Body paragraphs start with the label.');

    const ta = el('textarea', {
      id: 'elab-va-input',
      placeholder:
        '1 = host, zane\n2 = host, shane\n3 = narrator\n\n1 Welcome back to the show.\n2 Glad to be here.\n3 Today, one topic. Japan.',
      style: {
        width: '100%', height: '230px', boxSizing: 'border-box',
        border: '1px solid #ddd', borderRadius: '8px', padding: '10px',
        font: '400 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        resize: 'vertical',
      },
    });

    const status = el('div', { id: 'elab-va-status', style: { margin: '10px 0', minHeight: '18px', color: '#333', whiteSpace: 'pre-wrap' } });
    const fixup = el('div', { id: 'elab-va-fixup', style: { margin: '6px 0' } });

    const row = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } });
    const goBtn = el('button', { style: { ...baseBtn } }, 'Insert + Assign');
    const insertBtn = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Insert clean text only');
    const copyBtn = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Copy clean text');
    const minBtn = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Minimize');
    const closeBtn = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' }, title: 'Close and reset' }, 'Close');
    row.append(goBtn, insertBtn, copyBtn, minBtn, closeBtn);

    minBtn.addEventListener('click', minimizeModal);
    closeBtn.addEventListener('click', closeModal);
    copyBtn.addEventListener('click', () => {
      const { cleanText } = computeFromInput(ta.value, status);
      if (cleanText == null) return;
      try { GM_setClipboard(cleanText, { type: 'text', mimetype: 'text/plain' }); }
      catch (_) { navigator.clipboard && navigator.clipboard.writeText(cleanText); }
      setStatus(status, 'Clean text copied to clipboard.');
    });
    insertBtn.addEventListener('click', async () => {
      const parsed = computeFromInput(ta.value, status);
      if (!parsed) return;
      setStatus(status, 'Inserting clean text…');
      await insertIntoEditor(parsed.cleanText);
      setStatus(status, `Inserted. ${countNodes()} node(s) in the editor.`);
    });
    goBtn.addEventListener('click', async () => {
      try {
        await runFlow(ta.value, status, fixup);
      } catch (e) {
        warn('runFlow threw:', e && e.message ? e.message : String(e));
        setStatus(status, `✗ FAILED — ${e && e.message ? e.message : String(e)}. Debug tab → Copy debug.`);
      }
    });

    runView.append(help, ta, row, status, fixup);

    // ---- Debug tab ----
    const dbgHelp = el('div', { style: { color: '#555', marginBottom: '8px' } },
      'Logs + a self-graded run report. After a run, click "Verify now" then "Copy debug" and paste it back to me. "Snapshot picker DOM" grabs the voice picker markup.');
    dbgEl = el('textarea', {
      readOnly: true,
      style: {
        width: '100%', height: '300px', boxSizing: 'border-box',
        border: '1px solid #ddd', borderRadius: '8px', padding: '10px',
        font: '400 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'pre', resize: 'vertical',
      },
    });
    const dRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } });
    const dRefresh = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Refresh');
    const dCopy = el('button', { style: { ...baseBtn } }, 'Copy debug');
    const dSnap = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Snapshot picker DOM');
    const dVerify = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Verify now');
    const dClear = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Clear log');
    dRow.append(dRefresh, dCopy, dSnap, dVerify, dClear);
    const dStatus = el('div', { style: { marginTop: '8px', minHeight: '18px', color: '#333' } });

    dRefresh.addEventListener('click', refreshDebugTab);
    dCopy.addEventListener('click', () => {
      const blob = buildDebugBlob();
      try { GM_setClipboard(blob, { type: 'text', mimetype: 'text/plain' }); }
      catch (_) { navigator.clipboard && navigator.clipboard.writeText(blob); }
      setStatus(dStatus, `Copied ${blob.length} chars to clipboard.`);
    });
    dSnap.addEventListener('click', async () => {
      minimizeModal(); // un-obscure the page so the picker can render/open
      let msg = 'Could not capture picker (no nodes / see log).';
      try {
        const snap = await snapshotPickerDOM();
        if (!snap) {
          msg = 'Could not capture picker (no nodes / see log).';
        } else if (snap.opened === false) {
          msg = `Picker did not open — captured indicator + ${snap.candidates.length} visible candidate(s) instead (see Copy debug).`;
        } else {
          msg = `Captured picker (${snap.rows.length} rows, ${snap.html.length} chars).`;
        }
      } catch (e) {
        warn('snapshot threw:', e && e.message ? e.message : String(e));
        msg = `Snapshot failed: ${e && e.message ? e.message : String(e)} (see log).`;
      } finally {
        openModal(); // re-show with the result (state intact)
        setStatus(dStatus, msg);
        refreshDebugTab();
      }
    });
    dVerify.addEventListener('click', () => {
      if (!RUN.lastPlan || !RUN.lastLabelVoice) { setStatus(dStatus, 'Run "Insert + Assign" first, then verify.'); return; }
      const v = verifyAssignment(RUN.lastPlan, RUN.lastLabelVoice);
      RUN.report = RUN.report || {};
      RUN.report.verify = v;
      refreshDebugTab();
      setStatus(dStatus, `Verify score ${v.score} (distinct across groups: ${v.distinctAcrossGroups}).`);
    });
    dClear.addEventListener('click', () => { RUN.log = []; refreshDebugTab(); });

    dbgView.append(dbgHelp, dbgEl, dRow, dStatus);

    panel.append(title, tabs, runView, dbgView);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    refreshDebugTab();
    ta.focus();
  }

  function tabStyle(active) {
    return {
      cursor: 'pointer',
      border: '1px solid ' + (active ? '#111' : '#ddd'),
      background: active ? '#111' : '#fff',
      color: active ? '#fff' : '#444',
      borderRadius: '8px',
      padding: '6px 14px',
      font: '600 13px/1.2 Inter, system-ui, sans-serif',
    };
  }

  // Minimize: hide the modal but keep the element (and all its state — textarea,
  // current tab, debug log) alive. Re-clicking the launcher re-shows it.
  function minimizeModal() {
    const o = document.getElementById('elab-va-overlay');
    if (o) o.style.display = 'none';
  }
  // Close: fully tear down and reset (next open starts fresh).
  function closeModal() {
    const o = document.getElementById('elab-va-overlay');
    if (o) o.remove();
    dbgEl = null;
  }
  function setStatus(node, msg) { if (node) node.textContent = msg; }

  // Parse input -> { header, plan, cleanText } with basic validation.
  function computeFromInput(raw, status) {
    if (!raw || !raw.trim()) { setStatus(status, 'Paste some text first.'); return null; }
    const header = parseHeader(raw);
    if (!header.order.length) {
      setStatus(status, 'No header found. Start with mapping lines like "1 = host, zane", then a blank line, then the labeled body.');
      return null;
    }
    const labelSet = new Set(Object.keys(header.map));
    const paras = parseBody(header.bodyText, labelSet);
    if (!paras.length) { setStatus(status, 'No body paragraphs found under the header.'); return null; }
    const { plan, cleanText } = buildPlan(header, paras);
    return { header, paras, plan, cleanText, labelSet };
  }

  // The full flow: parse -> insert -> discover voices -> resolve -> (fixup) -> assign.
  async function runFlow(raw, status, fixup) {
    fixup.innerHTML = '';
    const parsed = computeFromInput(raw, status);
    if (!parsed) return;
    const { header, plan, cleanText } = parsed;

    RUN.report = {
      startedAt: new Date().toISOString(),
      parse: { roles: header.order.length, paragraphs: plan.length, cleanChars: cleanText.length },
    };
    RUN.lastPlan = plan;
    log('parse:', { roles: header.order.length, paragraphs: plan.length });

    // Pre-flight: verify the parse before touching the editor. Surface flagged
    // (placeholder) voice tokens so a malformed header is caught up front, not
    // mid-assign.
    const flagged = header.order
      .map((label) => ({ label, ...header.map[label] }))
      .filter((r) => r.voice && isPlaceholderVoice(r.voice));
    RUN.report.preflight = {
      roles: header.order.length,
      paragraphs: plan.length,
      flagged: flagged.map((r) => ({ label: r.label, title: r.title, token: r.voice })),
    };
    if (flagged.length) {
      const list = flagged.map((r) => `“${r.voice}” (${r.title})`).join(', ');
      log('preflight: ignoring invalid voice token(s):', list);
      setStatus(status, `Heads up: ${flagged.length} invalid voice token(s) ignored — ${list}. You'll be asked to pick. Inserting…`);
    }

    setStatus(status, 'Inserting clean text into the editor…');
    const nodesBefore = countNodes();
    const inserted = await insertIntoEditor(cleanText);
    if (!inserted) { setStatus(status, 'Could not insert text into the editor (is a Studio project open?).'); return; }

    const nodeCount = countNodes();
    RUN.report.insert = { nodesBefore, nodesAfter: nodeCount, planLength: plan.length, countsMatch: nodeCount === plan.length };
    let statusMsg = `Inserted ${nodeCount} node(s).`;
    if (nodeCount !== plan.length) statusMsg += ` Note: plan has ${plan.length} paragraph(s) — counts differ, will assign on the overlap.`;
    setStatus(status, statusMsg + ' Discovering voices…');

    // Available voices: node seed, plus a picker scrape if some names don't resolve.
    let voices = await discoverVoices();
    RUN.report.voices = { seed: voices.map((v) => v.name) };

    // Which roles need a voice? (header voice present and resolvable, or prompt)
    const roles = header.order.map((label) => ({ label, ...header.map[label] }));
    const needFix = []; // { label, title, reason }
    const labelVoice = new Map(); // label -> final voice NAME to click

    function tryResolveAll() {
      needFix.length = 0;
      for (const r of roles) {
        if (!r.voice) { needFix.push({ label: r.label, title: r.title, reason: 'no-voice' }); continue; }
        if (isPlaceholderVoice(r.voice)) {
          // Don't trust placeholder syntax; don't let it trigger a picker scrape.
          needFix.push({ label: r.label, title: r.title, reason: 'placeholder', wanted: r.voice });
          continue;
        }
        const res = resolveVoiceName(r.voice, voices);
        if (res.status === 'ok') labelVoice.set(r.label, res.match.name);
        else needFix.push({ label: r.label, title: r.title, reason: res.status, wanted: r.voice });
      }
      RUN.report.resolve = roles.map((r) => ({
        label: r.label, title: r.title, wanted: r.voice || null,
        resolvedTo: labelVoice.get(r.label) || null,
        needsFix: needFix.some((f) => f.label === r.label),
      }));
    }
    tryResolveAll();

    // If anything failed to resolve, try a live picker scrape to widen the set.
    // 'no-voice' and 'placeholder' are intentional prompts, not lookup misses —
    // they should NOT trigger a scrape.
    if (needFix.some((f) => f.reason !== 'no-voice' && f.reason !== 'placeholder')) {
      setStatus(status, statusMsg + ' Scraping voice list…');
      const scraped = await scrapeAllVoicesViaPicker();
      RUN.report.voices.scraped = scraped.map((v) => v.name);
      if (scraped.length) {
        const seen = new Set(voices.map((v) => norm(v.name)));
        scraped.forEach((v) => { if (!seen.has(norm(v.name))) voices.push(v); });
        tryResolveAll();
      }
    }

    if (!needFix.length) {
      await finishAssign();
      return;
    }

    // Build the fixup UI, keyed by role/title, grouped (one prompt per role).
    setStatus(status, statusMsg + ' Some roles need a voice:');
    const byTitle = new Map(); // title -> { labels:[], reason, wanted }
    for (const f of needFix) {
      const k = f.title;
      if (!byTitle.has(k)) byTitle.set(k, { title: f.title, labels: [], reason: f.reason, wanted: f.wanted });
      byTitle.get(k).labels.push(f.label);
    }
    const pendingSelects = [];
    byTitle.forEach((info) => {
      const line = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' } });
      const lab = el('div', { style: { minWidth: '160px' } },
        `Pick a voice for “${info.title}”` + (
          info.reason === 'none' ? ` (no match for “${info.wanted}”)` :
          info.reason === 'ambiguous' ? ` (“${info.wanted}” was ambiguous)` :
          info.reason === 'placeholder' ? ` (ignored invalid “${info.wanted}”)` : ''));
      const sel = el('select', { style: { flex: '1', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' } });
      sel.append(el('option', { value: '' }, '— choose —'));
      voices.forEach((v) => sel.append(el('option', { value: v.name }, v.name)));
      line.append(lab, sel);
      fixup.appendChild(line);
      pendingSelects.push({ info, sel });
    });

    const applyRow = el('div', { style: { marginTop: '8px' } });
    const applyBtn = el('button', { style: { ...baseBtn } }, 'Assign with these voices');
    applyRow.appendChild(applyBtn);
    fixup.appendChild(applyRow);

    applyBtn.addEventListener('click', async () => {
      for (const { info, sel } of pendingSelects) {
        if (!sel.value) { setStatus(status, `Still need a voice for “${info.title}”.`); return; }
        info.labels.forEach((label) => labelVoice.set(label, sel.value));
      }
      fixup.innerHTML = '';
      await finishAssign();
    });

    async function finishAssign() {
      let terminal = '✗ FAILED — see Debug tab → Copy debug.';
      // Hide our overlay while we drive the editor/picker so nothing is
      // obscured and focus stays on the page; re-show with the result after.
      minimizeModal();
      try {
        RUN.lastLabelVoice = labelVoice;
        RUN.report.labelVoice = [...labelVoice.entries()].map(([label, voice]) => ({ label, voice }));
        const res = await runAssignment(plan, labelVoice);
        RUN.report.assign = res;
        RUN.report.verify = verifyAssignment(plan, labelVoice);
        const v = RUN.report.verify;
        terminal = `✓ DONE — assigned ${res.ok}/${res.groups} group(s); verify ${v.score}. Debug tab → Copy debug, then save.`;
      } catch (e) {
        warn('assignment threw:', e && e.message ? e.message : String(e));
        RUN.report.error = (e && e.stack) ? e.stack : String(e);
        terminal = `✗ FAILED — ${e && e.message ? e.message : String(e)}. Debug tab → Copy debug.`;
      } finally {
        RUN.report.finishedAt = new Date().toISOString();
        openModal(); // re-show the modal (state intact) with the terminal status
        refreshDebugTab();
        setStatus(status, terminal);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // boot — keep the launcher present across SPA navigation
  // ----------------------------------------------------------------------------
  injectLauncher();
  setInterval(injectLauncher, 2000);

  // Expose the pure parser for manual console testing / calibration.
  window.__elabVA = { parseHeader, parseBody, buildPlan, resolveVoiceName, CONFIG };
})();
