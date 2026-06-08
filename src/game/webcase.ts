import { WebCase } from "./web";

/**
 * Wells Street as a constraint web. The alibi ("never left") is the key lie, but
 * it can't be broken head-on: the coat and the neighbor both get deflected
 * through the sleep story. Break the sleep story first (the call has nothing to
 * hide behind), and the deflections run dry.
 */
export const WELLS_WEB: WebCase = {
  id: "wells-web",
  weirdness: 0.1,
  title: "The Wells Street Stairs",
  subject: "Marcus Hale — the downstairs tenant",
  brief: {
    what: "Edmund Carr was found dead at the foot of his stairs, his neck broken. It reads like a fall.",
    where: "His building on Wells Street.",
    when: "The rain ran all night; the fall came between ten and midnight.",
    why: "Hale lives below Carr. They argued, loudly, that evening. He swears he never left his flat.",
    goal: "He'll deflect a head-on hit. Find what's propping the alibi up, and take that out first.",
  },
  segments: [
    { id: "home", name: "the alibi", key: true, base: "I never left my flat that night. Not once." },
    { id: "sleep", name: "the sleep story", base: "I'd been asleep since before ten. I heard nothing at all." },
  ],
  evidence: [
    { id: "coat", label: "His coat was logged soaked through at intake.", targets: "home", deflectableBy: ["sleep"] },
    { id: "neighbor", label: "A neighbor saw someone on the stairs at 10:30.", targets: "home", deflectableBy: ["sleep"] },
    { id: "call", label: "Phone records: a call from the building at 10:50.", targets: "sleep", deflectableBy: [] },
  ],
  startEvidence: ["coat", "neighbor", "call"],
  deflections: {
    "coat:sleep": [
      "I was dead asleep by then — how would I know how the coat got wet? A window, maybe.",
      "Asleep before the rain even came on. The coat could have caught the damp anywhere.",
      "I told you, I was sleeping. Ask the coat how it got wet, not me.",
    ],
    "neighbor:sleep": [
      "If I was asleep in my own bed, then whoever they saw on those stairs wasn't me.",
      "I was down for the night. Your neighbor saw someone — it wasn't me.",
      "Asleep means asleep. Someone on a staircase is no business of mine.",
    ],
  },
  concessions: {
    home: "...Fine. I went up. He was standing when I left him — I swear that part.",
    sleep: "...Alright. I was awake. I took the call — from my bed.",
  },
  resolution:
    "It was never a fall.\n\nThe sleep story was the floor under everything else. Once it went — the call put him awake at ten to eleven — the coat and the stairs had nothing left to stand on. He went up at half past ten, in the rain, over a debt Carr had stopped pretending he'd pay.\n\nHe didn't have an alibi. He had one lie holding up another, and you kicked out the bottom one.",
};
