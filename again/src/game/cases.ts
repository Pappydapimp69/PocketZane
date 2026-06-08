import { Case } from "./engine";

/**
 * Cases. Constant lines are context or truths that never move. `variants` lines
 * are the lies — they slip between phrasings when pressed to repeat.
 */
export const CASES: Case[] = [
  {
    id: "the-rain",
    title: "I. The Rain",
    subject: "the tenant",
    intro: "He says he was home all night. Ask him to tell it. Then ask again.",
    pinsToBreak: 3,
    strikes: 3,
    statements: [
      { id: "rain", text: "It rained the whole night. That part's true. You can check it." },
      {
        id: "door",
        variants: [
          "I locked the door at nine and never opened it.",
          "I locked the door at ten. I didn't touch it after.",
        ],
      },
      { id: "alone", text: "I live alone. No one came. No one called me, either." },
      {
        id: "sleep",
        variants: [
          "I was asleep before the news ended.",
          "I was asleep by midnight, maybe a little after.",
        ],
      },
      {
        id: "coat",
        variants: [
          "My coat was on the hook, dry, where it always is.",
          "My coat? On the hook. Dry. I told you I didn't go out.",
        ],
      },
      {
        id: "street",
        variants: [
          "I heard nothing. The street was empty.",
          "I heard a car, once. Late. It didn't stop.",
        ],
      },
      { id: "hide", text: "I have nothing to hide. Ask me as many times as you like." },
    ],
    resolution:
      "The rain was the only thing that held.\n\nThe coat was wet when they found it. He went out at ten, in the rain he told you about, and came back before the car he eventually remembered. A lie has to be carried. He set his down, once, and it was a different weight every time he picked it up.\n\nAn arrow travels in only one direction. So does a night. He kept trying to walk his backward, and it kept landing him somewhere new.",
  },
];
