/**
 * Sparse, low SFX via Web Audio — no asset files. The room is quiet; sounds are
 * deliberate: a knock to say "again", a clean strike to pin, a dull thud when
 * you accuse the truth.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem("again:muted") === "1";
  } catch {
    return false;
  }
}

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Master bus — everything routes through here so one toggle mutes it all. */
function out(): AudioNode {
  ac();
  return master!;
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Optional spoken narration of the end-screen text, via the browser's built-in
 * speech synthesis — no files, no network. Off by default (voices vary widely).
 */
export function speak(text: string): void {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").trim());
    u.rate = 0.86;
    u.pitch = 0.9;
    s.speak(u);
  } catch {
    /* speech unavailable — ignore */
  }
}

export function stopSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  try {
    localStorage.setItem("again:muted", muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  return muted;
}

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

function play(tones: Tone[]): void {
  const a = ac();
  const now = a.currentTime;
  for (const t of tones) {
    const start = now + (t.delay ?? 0);
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    const vol = t.vol ?? 0.1;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(gain).connect(out());
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

/** A short filtered-noise burst — the woody knock of a hand on a table. */
function knock(vol = 0.18): void {
  const a = ac();
  const now = a.currentTime;
  const dur = 0.12;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 380;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(filt).connect(gain).connect(out());
  src.start(now);
  src.stop(now + dur);
}

/** A low, near-subliminal room tone. Started on the first user gesture. */
let ambienceOn = false;
export function startAmbience(): void {
  if (ambienceOn) return;
  const a = ac();
  ambienceOn = true;
  const bus = a.createGain();
  bus.gain.value = 0.5;
  bus.connect(out());

  for (const f of [54, 54.4]) {
    const osc = a.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = a.createGain();
    g.gain.value = 0.02;
    osc.connect(g).connect(bus);
    osc.start();
  }

  const noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = a.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nf = a.createBiquadFilter();
  nf.type = "lowpass";
  nf.frequency.value = 220;
  const ng = a.createGain();
  ng.gain.value = 0.012;
  noise.connect(nf).connect(ng).connect(bus);
  noise.start();
}

export const SFX = {
  again: () => {
    knock(0.16);
    play([{ freq: 120, dur: 0.1, type: "sine", vol: 0.08, delay: 0.12 }]);
  },
  flicker: () => play([{ freq: 520, to: 660, dur: 0.07, type: "triangle", vol: 0.05 }]),
  select: () => play([{ freq: 330, dur: 0.05, type: "sine", vol: 0.06 }]),
  pin: () => {
    knock(0.1);
    play([
      { freq: 880, dur: 0.05, type: "square", vol: 0.07, delay: 0.02 },
      { freq: 1320, dur: 0.16, type: "triangle", vol: 0.09, delay: 0.05 },
    ]);
  },
  deny: () => play([{ freq: 240, to: 180, dur: 0.16, type: "sine", vol: 0.07 }]),
  wrong: () => play([{ freq: 110, to: 70, dur: 0.28, type: "sawtooth", vol: 0.08 }]),
  break: () =>
    play([
      { freq: 196, dur: 0.18, type: "triangle", vol: 0.1 },
      { freq: 262, dur: 0.18, type: "triangle", vol: 0.1, delay: 0.14 },
      { freq: 392, dur: 0.5, type: "triangle", vol: 0.1, delay: 0.28 },
    ]),
  heart: () =>
    play([
      { freq: 62, dur: 0.16, type: "sine", vol: 0.14 },
      { freq: 52, dur: 0.2, type: "sine", vol: 0.1, delay: 0.22 },
    ]),
};
