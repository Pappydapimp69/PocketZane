import { DCase } from "./deduction";

/**
 * Vertical-slice case for the redesign. Grounded noir (weirdness low). One
 * coherent truth; the cover story rewrites itself only when you corner it.
 *
 * Intended solve path:
 *   - present COAT → "home" rewrites (porch). question "home" → gain NEIGHBOR.
 *   - present NEIGHBOR → "home" rewrites (went up). present CORONER → "home" breaks.
 *   - question "time" → gain CALL. present CALL → "time" rewrites. present
 *     NEIGHBOR → "time" breaks.
 *   - (optional motive) question "money" → gain IOU. present IOU → "money" breaks.
 */
export const WELLS_STREET: DCase = {
  id: "wells-street",
  weirdness: 0.1,
  title: "The Wells Street Stairs",
  subject: "Marcus Hale — the downstairs tenant",
  brief: {
    what: "Edmund Carr was found dead at the foot of his stairs, his neck broken. It reads like a fall.",
    where: "His building on Wells Street.",
    when: "The rain ran all night; the fall came sometime between ten and midnight.",
    why: "You're sitting across from Hale, who lives below Carr. They argued — loudly — earlier that evening. He says he was home all night and never went up.",
    goal: "Break the alibi. Put him on those stairs.",
  },
  threads: [
    {
      id: "home",
      topic: "the alibi",
      key: true,
      defenses: [
        { claim: "I never left my flat. Not once, the whole night.", brokenBy: ["coat"] },
        { claim: "Alright — I stepped onto the porch for air, and the rain caught me. That's all the coat means.", brokenBy: ["neighbor"] },
        { claim: "Fine. I went up to tell him to keep the noise down. He was alive when I left him — I swear that.", brokenBy: ["coroner"] },
      ],
    },
    {
      id: "time",
      topic: "the hour",
      key: true,
      defenses: [
        { claim: "I was asleep before ten. I heard nothing.", brokenBy: ["call"] },
        { claim: "I was awake, then — I took a call. From my own bed.", brokenBy: ["neighbor"] },
      ],
    },
    {
      id: "money",
      topic: "the bad blood",
      defenses: [
        { claim: "He owed me nothing. We were square.", brokenBy: ["iou"] },
      ],
    },
  ],
  evidence: [
    { id: "rain", label: "It rained steadily all night — confirmed." },
    { id: "coat", label: "Hale's coat was logged soaked through at intake." },
    { id: "coroner", label: "The coroner puts the death at roughly 10:40." },
    { id: "neighbor", label: "A neighbor saw someone on the stairs near 10:30." },
    { id: "call", label: "Phone records: a call placed from the building at 10:50." },
    { id: "iou", label: "An unpaid IOU — Hale's name on it — in Carr's desk." },
  ],
  startEvidence: ["rain", "coat", "coroner"],
  probes: [
    { threadId: "home", reply: "Ask the neighbors, if you won't take my word. They'll tell you I keep to myself.", yields: ["neighbor"] },
    { threadId: "time", reply: "Check the phone, then. I've nothing to hide from a phone.", yields: ["call"] },
    { threadId: "money", reply: "We had words about the noise. That's all it ever was — noise.", yields: ["iou"] },
  ],
  resolution:
    "It was never a fall.\n\nHale went up at half past ten — the neighbor saw him, and the coat carried the rain up those stairs with him. The quarrel was money, not noise: the IOU was months overdue, and Carr had stopped pretending he'd pay. A hand to the chest to make a point, or a threat — and Carr went backward down the flight. The call at 10:50 was Hale, standing over him, losing his nerve before he ever dialed for help.\n\n\"Alive when I left\" was the last true-sounding thing he had, and the clock took even that. A lie has to keep one foot in the truth to stand. His ran out of floor.",
};
