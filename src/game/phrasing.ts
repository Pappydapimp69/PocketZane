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
  errand: ["I'd only popped out for cigarettes", "I was down at the corner shop a minute", "I'd stepped out for a packet of smokes", "I went for cigarettes, that's the whole of it"],
  bath: ["I was in the bath with the door shut", "I'd run a hot bath and shut the world out", "I was soaking, deaf to everything through the door", "I had the taps going, I'd not have heard a thing"],
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

/* ---------------------------------------------------------------------------
 * The rest of the case's language. Only deflections were generative before; the
 * alibi claims, the folds, the phase lies and the small truths all came from
 * fixed strings, so two different seeds still read almost identically. These
 * pools make every register vary while staying true to each support's identity
 * and the seam that breaks it. Picked by the seeded rng → still deterministic.
 * ------------------------------------------------------------------------- */

// The confident statement of each support (shown as the web segment).
const CLAIM: Record<string, string[]> = {
  sleep: ["I'd been asleep since before ten. I heard nothing.", "I was in bed and dead to the world by ten. Nothing reached me.", "I turned in early and slept clean through the night."],
  porch: ["I only stepped onto the porch a moment, for air.", "I went no further than my own porch, just to breathe.", "A minute on the porch — that's the whole of it."],
  dark: ["The stairwell light was out. No one could've seen a thing.", "That stair was pitch dark — no eye could swear to anything.", "The light was dead; the whole stairwell was black."],
  visitor: ["A friend sat with me the whole evening.", "I had company all night — a friend, right here with me.", "I wasn't alone; a friend kept me the whole evening."],
  drink: ["I'd had a few. I don't remember the half of it.", "I'd been drinking — most of that night's a blur to me.", "I was deep in the bottle; I can't account for much."],
  errand: ["I'd gone out for cigarettes — ten minutes, no more.", "I only stepped down to the corner shop for smokes.", "I was out for a packet of cigarettes, briefly."],
  bath: ["I was in the bath half the evening, the door shut.", "I'd run a long hot bath and heard nothing of it.", "I was soaking in the tub with the taps running."],
  partner: ["My partner was beside me the whole night. She'll tell you so.", "She was with me every hour of it — ask her yourself.", "My partner never left my side that night, and she'll swear it."],
  brother: ["My brother was here all evening — he saw the whole of it.", "My brother sat with me the night through; he watched it all.", "I had my brother for company all evening — ask him."],
};

// The fold — each gestures at the seam that broke the support.
const CONCEDE: Record<string, string[]> = {
  sleep: ["...Alright. I was awake — I took the call, from my bed.", "...Fine. I wasn't asleep. The phone rang and I answered it.", "...I was awake. I picked up the call, lying there."],
  porch: ["...Fine. I went further than the porch. Up the stairs.", "...Alright. Past the porch — I went up the stairs.", "...I didn't stop at the porch. I climbed the stairs."],
  dark: ["...The light worked. I know it worked.", "...Fine. The stair was lit. It always was.", "...The light was on. I only hoped you'd not check."],
  visitor: ["...There was no friend. I was alone all night.", "...No one came. I made the friend up. I was alone.", "...Fine. No visitor. I sat here alone the whole night."],
  drink: ["...I remember fine. I only hoped you wouldn't ask.", "...I was sober. I recall every minute of it.", "...Fine. I wasn't drunk. I remember all of it clearly."],
  errand: ["...The shop was shut. I never went for cigarettes at all.", "...There was no errand — the corner shop closed hours before.", "...Fine. I didn't go out. The shop was dark by then."],
  bath: ["...There was no bath. The water never ran that night.", "...Fine. I wasn't in the tub. I made that up.", "...The meter would show it — I ran no bath at all."],
  partner: ["...There was no partner beside me. I made her up to fill the bed.", "...She wasn't here. I invented her to fill the empty side.", "...Fine. No one shared my bed. I made her up."],
  brother: ["...My brother wasn't here. He'd cover for me, but he wasn't here.", "...He wasn't here. He'd lie for me, but he stayed away.", "...Fine. My brother was nowhere near. I borrowed his name."],
};

const CORE_CLAIM = ["I never left my flat that night. Not once.", "I never went up those stairs. Not once.", "I was nowhere near his door all evening.", "I didn't set foot outside my own door that night.", "I stayed in my flat the whole night. I never moved."];
const CORE_CONCEDE = ["...Fine. I went up. He was standing when I left him.", "...Alright. I went up. Only to talk to him.", "...I was at his door. I knocked. That's all.", "...I went up those stairs. He was alive when I left.", "...Fine. I was at his door that night. We talked."];

// What stood between them — picked whole so the motive, its fold, and the tell
// that breaks it all agree (a debt, a woman, an old ruin).
interface MotiveT {
  claim: string;
  concession: string;
  evShort: string;
  evLabel: string;
}
const MOTIVES: MotiveT[] = [
  { claim: "We were square. I'd no reason to touch him.", concession: "...He held a marker of mine. Months overdue, and he'd stopped pretending he'd pay.", evShort: "the IOU", evLabel: "An unpaid IOU — his name on it — in the desk." },
  { claim: "There was no bad blood. We barely spoke.", concession: "...He'd been seeing her. The woman I meant to marry.", evShort: "the letter", evLabel: "A letter in her hand, found folded in the victim's coat." },
  { claim: "We'd no quarrel. Why would I want him hurt?", concession: "...He ruined me, years back. I never once let it go.", evShort: "the threat", evLabel: "A note in the suspect's hand: 'You'll answer for it.'" },
  { claim: "Money never came between us. Nor anything else.", concession: "...He'd been bleeding me for months. I'd had my fill of paying.", evShort: "the ledger", evLabel: "A ledger of cash drawn out, dated to the week he died." },
];
export function motivePick(rng: () => number): MotiveT {
  return pick(MOTIVES, rng);
}

// Phase lies escalate deny → hedge → admit. Vary each rung but keep the arc.
const SHIFT: Record<string, { deny: string[]; hedge: string[]; admit: string[] }> = {
  call: { deny: ["My phone was off the whole night.", "The phone never rang once.", "I didn't touch the phone all night."], hedge: ["Off, or near enough — I didn't answer it.", "It may have rung. I didn't pick it up.", "If it rang, I slept through it."], admit: ["Fine. It rang, and I picked up. From my bed.", "Alright — it rang and I answered, lying there.", "It rang. I took the call. From bed."] },
  mud: { deny: ["I never once opened my door.", "My door stayed shut all night.", "I didn't step out, not once."], hedge: ["I cracked it for air, no more than that.", "I opened it a moment, that's all.", "I put my head out, nothing further."], admit: ["Alright — I stepped out onto the landing.", "Fine. I went out onto the landing.", "I went out. Onto the upper landing."] },
  log: { deny: ["That stairwell's been pitch black a month.", "The stair light's been dead for weeks.", "There's been no light on that stair in a month."], hedge: ["The light flickered, mostly out.", "It half-worked, if at all.", "It came and went, mostly dark."], admit: ["It was lit. I only hoped you'd think it wasn't.", "Fine — the light worked. It always did.", "The stair was lit. I knew it was."] },
  alone: { deny: ["A friend sat with me all evening.", "I had a friend here the whole night.", "Someone was with me all evening."], hedge: ["He came by for a while, anyway.", "He looked in for a bit, I think.", "He was here part of the night, at least."], admit: ["Alright. No one came. I was alone.", "Fine — no friend. I sat here alone.", "No one came by. I was alone all night."] },
  sober: { deny: ["I'd drunk too much to recall a thing.", "I was too far gone to remember.", "The drink wiped the night clean from me."], hedge: ["I'd had a couple, that's all.", "A drink or two, nothing that clouds me.", "I wasn't so far gone, I suppose."], admit: ["I was stone sober. I just didn't want to say.", "Fine. I was sober. I remember it all.", "I'd not touched a drop. I recall everything."] },
  shop: { deny: ["I was at the corner shop when it happened.", "I'd gone out to the shop, plainly.", "I was buying cigarettes at the time."], hedge: ["I meant to go to the shop, near enough.", "I stepped out that way, more or less.", "I was headed for the shop, anyhow."], admit: ["The shop was shut. I never went.", "Fine — the shop was dark. I stayed in.", "I didn't go out at all. The shop had closed."] },
  water: { deny: ["I was in the bath the whole while.", "I'd run a bath and sat in it an hour.", "I was soaking in the tub right through it."], hedge: ["I'd half a mind to bathe, anyhow.", "I ran the taps a while, at least.", "I was near the bath, in any case."], admit: ["I ran no bath. I made it up.", "Fine — there was no bath that night.", "The water never ran. I wasn't bathing at all."] },
  sister: { deny: ["My partner was beside me every minute.", "She never left my side all night.", "She was with me the whole night through."], hedge: ["She was in and out, but mostly with me.", "She stepped away once or twice, that's all.", "She was about, near enough the whole time."], admit: ["She... she wasn't there. I'll say it.", "Fine. She wasn't with me at all.", "She wasn't here. I'll admit that much."] },
  ticket: { deny: ["My brother watched the whole evening with me.", "My brother was here the night through.", "My brother sat with me all evening."], hedge: ["He was around, in any case.", "He was here a while, anyhow.", "He came by, at least for a time."], admit: ["He wasn't here. I only wished he were.", "Fine. My brother was nowhere near.", "He never came. I made it up."] },
  iou: { deny: ["There was nothing between us.", "We'd no quarrel at all.", "We were on the best of terms."], hedge: ["We'd had words, once or twice.", "There was something, maybe, long ago.", "Nothing that would ever come to this."], admit: ["Alright — there was bad blood between us.", "We were enemies, if you want the word.", "He'd wronged me, and I never forgot it."] },
};

// Small, true asides for the phases — the lines that don't move.
const TRUTHS: Record<string, string[]> = {
  call: ["I turn in early. Always have.", "It was a quiet night, until your knock.", "The walls here are thin; I'd have heard a struggle.", "I sleep poorly, but I stay in bed."],
  mud: ["I keep my door locked. Always have.", "The hall light's been out for weeks.", "I leave my boots at the door — I track in nothing.", "I'd no reason to go up there."],
  log: ["I've complained about that light before.", "People trip on those stairs all the time.", "The whole building knows that stair's a hazard.", "I use the rail, not my eyes, on those steps."],
  alone: ["I don't have many friends to speak of.", "I keep to myself most nights.", "Most evenings it's just me and the radio.", "I'd not have known what to do with company."],
  sober: ["I drink at the same place every week.", "I always walk home, never drive.", "The barman knows me by name.", "I never make trouble when I drink."],
  shop: ["I smoke too much, always have.", "The corner shop's a minute's walk.", "I keep odd hours, everyone knows it.", "I never carry more than a packet's worth."],
  water: ["I take a bath most nights.", "The plumbing here is loud as anything.", "I like the door shut when I bathe.", "I keep to my own rooms, mostly."],
  sister: ["We've been together some years now.", "She sleeps lighter than I do.", "We keep separate hours, mostly.", "She'd tell you herself if she could."],
  ticket: ["My brother and I are close.", "He visits when he can.", "We grew up two streets apart.", "He'd come if I asked him to."],
  iou: ["We'd been neighbors a long time.", "We argued about noise, nothing more.", "We passed on the stairs, said little.", "Whatever was between us was years old."],
};

// The bare facts of the death — varied, but all the same night-fall premise the
// seams are built around (a man down at the foot of his stairs, in the rain).
const WHAT = [
  "{v} was found dead at the foot of his stairs, his neck broken. It reads like a fall.",
  "{v} lay dead at the bottom of the stairwell, his skull split on the tile. A fall, by the look of it.",
  "They found {v} crumpled at the foot of the stairs, cold since the night before. It reads as an accident.",
  "{v} was found broken at the bottom of his own steps. The coroner wrote it a fall.",
];
const WHEN = [
  "The rain ran all night; the fall came between ten and midnight.",
  "It rained without let-up; he went down sometime between ten and twelve.",
  "The storm covered every sound; he fell in the hours before midnight.",
  "Rain all evening, and no witness to the fall — only that it came late.",
];
export function premise(victim: string, rng: () => number): { what: string; when: string } {
  return { what: pick(WHAT, rng).replace("{v}", victim), when: pick(WHEN, rng) };
}

export function claimLine(id: string, rng: () => number): string {
  return pick(CLAIM[id] ?? CORE_CLAIM, rng);
}
export function concessionLine(id: string, rng: () => number): string {
  return pick(CONCEDE[id] ?? CORE_CONCEDE, rng);
}
export function coreClaim(rng: () => number): string {
  return pick(CORE_CLAIM, rng);
}
export function coreConcession(rng: () => number): string {
  return pick(CORE_CONCEDE, rng);
}

/** The three escalating tellings of a phase lie, keyed by its seam. */
export function shiftTriple(seamId: string, rng: () => number): string[] {
  const s = SHIFT[seamId];
  if (!s) return ["I've told you all I know.", "That's all there is to it.", "Fine. There's more — but that's the shape of it."];
  return [pick(s.deny, rng), pick(s.hedge, rng), pick(s.admit, rng)];
}

/** Two distinct true asides for a phase, keyed by its seam. */
export function phaseTruths(seamId: string, rng: () => number): string[] {
  const pool = TRUTHS[seamId] ?? ["I keep to myself, mostly.", "I'd no part in it."];
  const x = [...pool];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x.slice(0, 2);
}
