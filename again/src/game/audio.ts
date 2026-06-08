/**
 * Sparse, low SFX via Web Audio — no asset files. The room is quiet; sounds are
 * deliberate: a knock to say "again", a clean strike to pin, a dull thud when
 * you accuse the truth.
 */
let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
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
    osc.connect(gain).connect(a.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

export const SFX = {
  again: () =>
    play([
      { freq: 150, dur: 0.09, type: "sine", vol: 0.14 },
      { freq: 130, dur: 0.12, type: "sine", vol: 0.12, delay: 0.13 },
    ]),
  flicker: () => play([{ freq: 520, to: 660, dur: 0.07, type: "triangle", vol: 0.05 }]),
  select: () => play([{ freq: 330, dur: 0.05, type: "sine", vol: 0.06 }]),
  pin: () =>
    play([
      { freq: 880, dur: 0.05, type: "square", vol: 0.07 },
      { freq: 1320, dur: 0.14, type: "triangle", vol: 0.09, delay: 0.04 },
    ]),
  deny: () => play([{ freq: 240, to: 180, dur: 0.16, type: "sine", vol: 0.07 }]),
  wrong: () => play([{ freq: 110, to: 70, dur: 0.28, type: "sawtooth", vol: 0.08 }]),
  break: () =>
    play([
      { freq: 196, dur: 0.18, type: "triangle", vol: 0.1 },
      { freq: 262, dur: 0.18, type: "triangle", vol: 0.1, delay: 0.14 },
      { freq: 392, dur: 0.5, type: "triangle", vol: 0.1, delay: 0.28 },
    ]),
};
