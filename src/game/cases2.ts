import { DCase } from "./deduction";

/**
 * Vertical slice for the phase + confrontation redesign. Grounded noir.
 *
 * Facts (what the cover defends):  was-outside (res 3), the-hour (res 3),
 * the-money (res 1). Leads press facts by weight — the coat and the neighbor
 * both push on was-outside, and the neighbor also nicks the-hour.
 *
 * Solvable even if you fail every phase: from the coat alone, a partial press
 * reveals the neighbor, the neighbor reveals the call, and the key facts cave.
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
    why: "You're across from Hale, who lives below Carr. They argued — loudly — earlier that evening. He says he was home all night and never went up.",
    goal: "Work the three points, then break his statement. Put him on those stairs.",
  },

  facts: [
    { id: "outside", resistance: 3 },
    { id: "hour", resistance: 3 },
    { id: "money", resistance: 1 },
  ],

  leads: [
    {
      id: "coat",
      label: "His coat was logged soaked through at intake.",
      applies: [{ fact: "outside", weight: 1, rebuttal: "The coat? It caught the rain on the porch. Nothing more." }],
    },
    {
      id: "neighbor",
      label: "A neighbor saw someone on the stairs near 10:30.",
      applies: [
        { fact: "outside", weight: 2, rebuttal: "Whoever they saw on those stairs, it wasn't me." },
        { fact: "hour", weight: 1, rebuttal: "Someone on a staircase tells you nothing about when I slept." },
      ],
    },
    {
      id: "call",
      label: "Phone records: a call from the building at 10:50.",
      applies: [{ fact: "hour", weight: 2, rebuttal: "A man can take one call and still call it an early night." }],
    },
    {
      id: "iou",
      label: "An unpaid IOU — Hale's name on it — in Carr's desk.",
      applies: [{ fact: "money", weight: 1, rebuttal: "An old marker. It meant nothing between us." }],
    },
  ],
  startLeads: ["coat"],

  phases: [
    {
      id: "where",
      title: "I.  Whereabouts",
      prompt: "Where he was. Press the account; pin the line that won't hold.",
      statements: [
        { id: "rain", text: "It came down hard all night. That much you can check." },
        {
          id: "stairs",
          text: "Those stairs sat empty all evening — I'd have heard them.",
          lie: {
            shifts: [
              "Those stairs sat empty all evening — I'd have heard them.",
              "Well — someone may have used them. People come and go.",
              "Alright, I heard steps. Once. It wasn't me on them.",
            ],
            lead: "neighbor",
          },
        },
        { id: "keep", text: "I keep to myself down there. I don't go looking for company." },
      ],
    },
    {
      id: "hour",
      title: "II.  The Hour",
      prompt: "When he turned in. Find the line that drifts.",
      statements: [
        { id: "early", text: "I turn in early. Always have." },
        {
          id: "phone",
          text: "My phone was off the whole night.",
          lie: {
            shifts: [
              "My phone was off the whole night.",
              "Off, or near enough — I didn't answer it.",
              "Fine. It rang, and I picked up. From my bed.",
            ],
            lead: "call",
          },
        },
        { id: "quiet", text: "It was a quiet night, until your knock." },
      ],
    },
    {
      id: "money",
      title: "III.  The Bad Blood",
      prompt: "What stood between them. Catch the thing he keeps smoothing over.",
      statements: [
        { id: "years", text: "We'd been neighbors three years. No trouble to speak of." },
        {
          id: "owed",
          text: "Money never came up between Carr and me.",
          lie: {
            shifts: [
              "Money never came up between Carr and me.",
              "We may have spoken of it. In passing, once.",
              "He held a marker of mine. It was nothing. Months old.",
            ],
            lead: "iou",
          },
        },
        { id: "noise", text: "What we argued about was noise. His, not mine." },
      ],
    },
  ],

  confront: {
    intro: "He's had time to think. Now he gives it to you whole — one account, start to finish. Break it.",
    claims: [
      {
        id: "home",
        key: true,
        fact: "outside",
        text: "I was in my flat the whole night. I never set foot on those stairs.",
        rebuttals: [
          "I stepped out to the porch for a moment — the rain caught my coat. That's all it is.",
          "Alright. I went up to tell him to quiet down. He was standing when I left him.",
        ],
        revealsOnPartial: "neighbor",
      },
      {
        id: "asleep",
        key: true,
        fact: "hour",
        text: "I'd been asleep since before ten. I heard nothing.",
        rebuttals: [
          "I was awake, then — I took a call. From my bed.",
          "The call ran later than I said. It changes nothing.",
        ],
        revealsOnPartial: "call",
      },
      {
        id: "square",
        key: false,
        fact: "money",
        text: "Carr and I were square. I had no reason in the world to touch him.",
        rebuttals: ["A small marker, long forgotten."],
      },
    ],
  },

  resolution:
    "It was never a fall.\n\nHale went up at half past ten — the neighbor saw him, and the rain rode up those stairs in his coat. The quarrel was money: the marker was months overdue, and Carr had stopped pretending he'd pay. A hand to the chest to make a point, or a threat, and Carr went backward down the flight. The call at 10:50 was Hale standing over him, losing his nerve before he ever dialed for help.\n\n\"He was standing when I left\" was the last true-sounding thing he had, and stacked against the coat, the stairs, and the clock, it had nowhere left to stand. A lie keeps one foot in the truth. You took the floor out from under the other.",
};
