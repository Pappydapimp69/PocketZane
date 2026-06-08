import { MergedCase } from "./merged";

/**
 * Wells Street, unified. Three phases gather leads (the coat is in the file from
 * the start; the phases turn up the neighbor, the call, and the IOU). Then the
 * confrontation is the web: the alibi deflects through the sleep story, so you
 * break the sleep story (with the call) before the coat or the neighbor can land.
 * Fail every phase and it's still winnable — leaning on the sleep story hands you
 * the call.
 */
export const WELLS: MergedCase = {
  id: "wells",
  weirdness: 0.1,
  title: "The Wells Street Stairs",
  subject: "Marcus Hale — the downstairs tenant",
  brief: {
    what: "Edmund Carr was found dead at the foot of his stairs, his neck broken. It reads like a fall.",
    where: "His building on Wells Street.",
    when: "The rain ran all night; the fall came between ten and midnight.",
    why: "Hale lives below Carr. They argued, loudly, that evening. He swears he never left his flat.",
    goal: "Work the three points for leads, then break his statement. A head-on hit will only deflect.",
  },

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
              "Alright, I heard steps once. It wasn't me on them.",
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

  startLeads: ["coat"],

  web: {
    id: "wells-web",
    weirdness: 0.1,
    title: "The Wells Street Stairs",
    subject: "Marcus Hale",
    brief: { what: "", where: "", when: "", why: "", goal: "" },
    segments: [
      { id: "home", name: "the alibi", key: true, base: "I never left my flat that night. Not once." },
      { id: "sleep", name: "the sleep story", base: "I'd been asleep since before ten. I heard nothing at all." },
      { id: "square", name: "the motive", base: "Carr and I were square. I'd no reason to touch him." },
    ],
    evidence: [
      { id: "coat", label: "His coat was logged soaked through at intake.", targets: "home", deflectableBy: ["sleep"] },
      { id: "neighbor", label: "A neighbor saw someone on the stairs at 10:30.", targets: "home", deflectableBy: ["sleep"] },
      { id: "call", label: "Phone records: a call from the building at 10:50.", targets: "sleep", deflectableBy: [] },
      { id: "iou", label: "An unpaid IOU — Hale's name on it — in Carr's desk.", targets: "square", deflectableBy: [] },
    ],
    startEvidence: [],
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
      square: "...He held a marker of mine. Months overdue. He'd stopped pretending he'd pay.",
    },
    resolution: "",
  },

  resolution:
    "It was never a fall.\n\nThe sleep story was the floor under everything else. Once it went — the call put him awake at ten to eleven — the coat and the stairs had nothing left to stand on. He went up at half past ten, in the rain, over a debt Carr had stopped pretending he'd pay.\n\nHe didn't have an alibi. He had one lie holding up another, and you kicked out the bottom one.",
};
