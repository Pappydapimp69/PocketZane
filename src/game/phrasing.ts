/**
 * Generative phrasing (step 5). A deflection is the suspect leaning on a support
 * to wave off a specific attack. Instead of a fixed pool of lines, we compose it
 * from a seeded grammar: an assertion of the alt-cause (support-specific) + a
 * dismissal of the attack (attack-aware). This kills the repetition — two lies
 * leaning on the same support no longer say the same sentence, because the attack
 * is part of the line, and a lie never deflects the same way twice as the seed
 * advances.
 */

const ASSERT: Record<string, string[]> = {
  sleep: ["I was dead asleep by then", "I'd not stirred from my bed since ten", "I was out cold before the rain even came on", "I was sleeping like the dead", "my eyes were shut hours before that"],
  porch: ["I only stepped onto the porch a moment", "I put my head out for the air, no more", "I stood on my own step a minute", "I never went a foot past the porch rail"],
  dark: ["that stairwell was black as pitch", "there wasn't light enough to see a hand in front of you", "the lamp was dead and the whole stair dark", "you couldn't tell a man from a coat-rack in that dark"],
  visitor: ["I had a friend sitting right with me", "there was a man here the whole evening", "I wasn't alone — I had company", "someone was here who'll vouch for every minute"],
  drink: ["I'd drunk enough to lose the thread of it", "I was three sheets to the wind by then", "I'd not have known my own name", "the drink had the better of me"],
  partner: ["my partner was right beside me", "she was with me the whole of it", "I had her there beside me all night", "she never once left my side"],
  brother: ["my brother sat with me the whole evening", "he was here — he saw all of it", "I had my brother for company", "he was right here, he'll swear to it"],
};

const DISMISS = [
  "{a} has nothing to do with me",
  "whatever you make of {a}, it wasn't me",
  "{a} changes nothing",
  "I'll not be hung on {a}",
  "make of {a} what you like",
  "{a}? That settles nothing",
  "it wasn't me, whatever {a} is",
  "that's no concern of mine",
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pick = <T>(a: T[], rng: () => number): T => a[Math.floor(rng() * a.length)];

export function deflectionLine(supportId: string, attackShort: string, rng: () => number): string {
  const assert = pick(ASSERT[supportId] ?? ["I had my reasons"], rng);
  const dismiss = pick(DISMISS, rng).replace("{a}", attackShort);
  const sep = Math.floor(rng() * 3);
  if (sep === 0) return `${cap(assert)}. ${cap(dismiss)}.`;
  if (sep === 1) return `${cap(assert)} — ${dismiss}.`;
  return `${cap(assert)}; ${dismiss}.`;
}

/** A pool of `n` distinct deflection lines for one (support, attack) pair. */
export function deflectionPool(n: number, supportId: string, attackShort: string, rng: () => number): string[] {
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const l = deflectionLine(supportId, attackShort, rng);
    if (!out.includes(l)) out.push(l);
  }
  while (out.length < n) out.push(deflectionLine(supportId, attackShort, rng));
  return out;
}
