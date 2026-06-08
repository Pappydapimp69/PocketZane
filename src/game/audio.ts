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

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/**
 * Generative noir ambience. A slow minor chord progression that actually moves
 * (Am – F – C – E), sparse single notes wandering over it on the A-minor scale,
 * and a soft feedback-delay "room" for space — so it evolves instead of droning.
 * Started on the first user gesture; routes through the master bus (honors mute).
 */
let ambienceOn = false;
export function startAmbience(): void {
  if (ambienceOn) return;
  const a = ac();
  ambienceOn = true;

  const bus = a.createGain();
  bus.gain.setValueAtTime(0.0001, a.currentTime);
  bus.gain.linearRampToValueAtTime(0.8, a.currentTime + 5);
  const tone = a.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  bus.connect(tone).connect(out());

  // Cheap reverb: a feedback delay the voices also feed into.
  const delay = a.createDelay();
  delay.delayTime.value = 0.34;
  const fb = a.createGain();
  fb.gain.value = 0.4;
  const wet = a.createGain();
  wet.gain.value = 0.32;
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(bus);

  const voice = (freq: number, t: number, dur: number, vol: number, type: OscillatorType): void => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.setValueAtTime((Math.random() - 0.5) * 6, t);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.6, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    g.connect(delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  // Harmonic movement: i – VI – III – V in A minor (Am, F, C, E major).
  const chords = [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [52, 56, 59],
  ];
  let ci = 0;
  const CHORD_DUR = 14;
  const chordTick = (): void => {
    if (!ambienceOn) return;
    const t = a.currentTime + 0.05;
    for (const n of chords[ci]) voice(midi(n - 12), t, CHORD_DUR, 0.045, "triangle");
    ci = (ci + 1) % chords.length;
    setTimeout(chordTick, (CHORD_DUR - 3) * 1000); // overlap for a soft crossfade
  };
  chordTick();

  // Sparse wandering melody over the chords (A harmonic-minor-ish).
  const scale = [57, 59, 60, 62, 64, 65, 68, 69];
  let lastIdx = 0;
  const melodyTick = (): void => {
    if (!ambienceOn) return;
    if (Math.random() < 0.8) {
      // Step mostly by small intervals so it feels like a line, not random.
      const step = Math.floor(Math.random() * 5) - 2;
      lastIdx = Math.max(0, Math.min(scale.length - 1, lastIdx + step));
      const oct = Math.random() < 0.5 ? 12 : 0;
      const n = scale[lastIdx] + oct;
      const t = a.currentTime + 0.05;
      voice(midi(n), t, 1.6 + Math.random() * 1.6, 0.05, "sine");
      if (Math.random() < 0.28) voice(midi(n + (Math.random() < 0.5 ? 3 : 4)), t + 0.2, 1.2, 0.03, "sine");
    }
    setTimeout(melodyTick, 2200 + Math.random() * 4200);
  };
  setTimeout(melodyTick, 3000);
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
  page: () => play([{ freq: 1200, to: 560, dur: 0.13, type: "sine", vol: 0.04 }]),
};
