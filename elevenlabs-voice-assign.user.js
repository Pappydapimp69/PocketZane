// ==UserScript==
// @name         ElevenLabs Studio — Label Voice Assigner
// @namespace    https://github.com/pappydapimp69/pocketzane
// @version      0.1.0
// @description  Paste labeled, header-mapped text into ElevenLabs Studio; strip the labels, insert the clean text, and bulk-assign voices per role (voice-by-voice multi-select).
// @match        https://elevenlabs.io/app/studio/*
// @run-at       document-idle
// @grant        GM_setClipboard
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
  // small utils
  // ----------------------------------------------------------------------------
  const log = (...a) => CONFIG.debug && console.log('[voice-assign]', ...a);
  const warn = (...a) => console.warn('[voice-assign]', ...a);
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
      view: window,
      clientX: Math.floor(rect.left + rect.width / 2),
      clientY: Math.floor(rect.top + rect.height / 2),
      ctrlKey: multi,
      metaKey: multi,
    };
    target.dispatchEvent(new PointerEvent('pointerdown', opts));
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new PointerEvent('pointerup', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.dispatchEvent(new MouseEvent('click', opts));
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

  async function insertIntoEditor(text) {
    const editor = getEditor();
    if (!editor) {
      warn('editor not found:', CONFIG.editorSelector);
      return false;
    }
    editor.focus();
    // Clear existing content.
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (_) {}

    const before = countNodes();

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
    const known = new Set([...document.querySelectorAll(CONFIG.pickerContainerSelectors.join(','))]);
    await realClick(indicator);
    const container = await waitFor(
      () => {
        const all = [...document.querySelectorAll(CONFIG.pickerContainerSelectors.join(','))];
        const fresh = all.filter((el) => isVisible(el) && !known.has(el));
        return fresh.length ? fresh[fresh.length - 1] : null;
      },
      { timeout: CONFIG.pickerOpenTimeout, poll: CONFIG.pickerPoll }
    );
    if (!container) {
      warn('picker did not open / not detected');
      return null;
    }
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
    const nodes = getNodes();
    if (nodes.length !== plan.length) {
      warn(`node count (${nodes.length}) != plan length (${plan.length}); proceeding on the overlap`);
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
    closeModal();
    const overlay = el('div', {
      id: 'elab-va-overlay',
      style: {
        position: 'fixed', inset: '0', zIndex: String(Z + 1),
        background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      },
    });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });

    const panel = el('div', {
      style: {
        width: 'min(720px, 92vw)', maxHeight: '88vh', overflow: 'auto',
        background: '#fff', color: '#111', borderRadius: '14px',
        padding: '18px', boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
        font: '400 13px/1.45 Inter, system-ui, sans-serif',
      },
    });

    const title = el('div', { style: { font: '600 16px/1.2 Inter, system-ui, sans-serif', marginBottom: '6px' } }, 'Label Voice Assigner');
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
    const closeBtn = el('button', { style: { ...baseBtn, background: '#fff', color: '#111' } }, 'Close');
    row.append(goBtn, insertBtn, copyBtn, closeBtn);

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
    goBtn.addEventListener('click', () => runFlow(ta.value, status, fixup));

    panel.append(title, help, ta, row, status, fixup);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    ta.focus();
  }

  function closeModal() {
    const o = document.getElementById('elab-va-overlay');
    if (o) o.remove();
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

    setStatus(status, 'Inserting clean text into the editor…');
    const inserted = await insertIntoEditor(cleanText);
    if (!inserted) { setStatus(status, 'Could not insert text into the editor (is a Studio project open?).'); return; }

    const nodeCount = countNodes();
    let statusMsg = `Inserted ${nodeCount} node(s).`;
    if (nodeCount !== plan.length) statusMsg += ` Note: plan has ${plan.length} paragraph(s) — counts differ, will assign on the overlap.`;
    setStatus(status, statusMsg + ' Discovering voices…');

    // Available voices: node seed, plus a picker scrape if some names don't resolve.
    let voices = await discoverVoices();

    // Which roles need a voice? (header voice present and resolvable, or prompt)
    const roles = header.order.map((label) => ({ label, ...header.map[label] }));
    const needFix = []; // { label, title, reason }
    const labelVoice = new Map(); // label -> final voice NAME to click

    function tryResolveAll() {
      needFix.length = 0;
      for (const r of roles) {
        if (!r.voice) { needFix.push({ label: r.label, title: r.title, reason: 'no-voice' }); continue; }
        const res = resolveVoiceName(r.voice, voices);
        if (res.status === 'ok') labelVoice.set(r.label, res.match.name);
        else needFix.push({ label: r.label, title: r.title, reason: res.status, wanted: r.voice });
      }
    }
    tryResolveAll();

    // If anything failed to resolve, try a live picker scrape to widen the set.
    if (needFix.some((f) => f.reason !== 'no-voice')) {
      setStatus(status, statusMsg + ' Scraping voice list…');
      const scraped = await scrapeAllVoicesViaPicker();
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
        `Pick a voice for “${info.title}”` + (info.reason === 'none' ? ` (no match for “${info.wanted}”)` : info.reason === 'ambiguous' ? ` (“${info.wanted}” was ambiguous)` : ''));
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
      setStatus(status, 'Assigning voices…');
      const res = await runAssignment(plan, labelVoice);
      setStatus(status, `Done: assigned ${res.ok}/${res.groups} voice group(s). Verify, then save.`);
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
