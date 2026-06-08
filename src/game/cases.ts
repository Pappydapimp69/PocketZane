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

  {
    id: "the-favor",
    title: "II. The Favor",
    subject: "the friend",
    intro: "She came to vouch for him. Loyalty is steady. An alibi built to order is not.",
    pinsToBreak: 4,
    strikes: 3,
    statements: [
      { id: "knew", text: "I've known him fifteen years. That doesn't change." },
      {
        id: "where",
        variants: [
          "We were at my place the whole evening.",
          "We were at the bar on Fifth, then my place.",
          "We were at his place, mostly. Then mine.",
        ],
      },
      {
        id: "what",
        variants: [
          "We watched the game. He never left my sight.",
          "We played cards. I'd have noticed if he stepped out.",
        ],
      },
      { id: "ask", text: "He didn't ask me to say any of this. I came on my own." },
      {
        id: "left",
        variants: [
          "He left a little after eleven.",
          "He left near one. I walked him down.",
          "He left when the rain started. I didn't check the clock.",
        ],
      },
      {
        id: "drink",
        variants: [
          "Neither of us drank. It was a quiet night.",
          "We had a couple. Nothing serious.",
        ],
      },
      {
        id: "call",
        variants: [
          "My phone was off. We weren't to be disturbed.",
          "My phone rang once. I didn't answer it.",
        ],
      },
      { id: "sure", text: "I'm sure of all of it. Ask me however many times you need." },
    ],
    resolution:
      "Fifteen years was true. So was the part where he never asked — he didn't have to. She built the rest in the doorway on her way over, and a thing built that fast has no floor under it.\n\nThe place moved. The hour moved. The drink she swore off appeared. Loyalty doesn't rehearse, and it doesn't need to. Only the invented does, and it never gets the lines the same.\n\nShe came to give him a night. What she gave you was the shape of one, redrawn each time you asked.",
  },

  {
    id: "the-loop",
    title: "III. The Loop",
    subject: "the man who keeps the night",
    intro: "He says the same evening keeps happening. Maybe it does. The evening still can't agree with itself.",
    pinsToBreak: 4,
    strikes: 2,
    statements: [
      { id: "begins", text: "It always begins the same way. A clock. A door. Rain that hasn't started yet." },
      {
        id: "clock",
        variants: [
          "The clock reads 9:14 when it starts. It always reads 9:14.",
          "The clock reads 11:14. I'd know it anywhere.",
          "The clock has no hands. It only ever did the once.",
        ],
      },
      {
        id: "her",
        variants: [
          "She is already in the room when I arrive.",
          "She comes in after me. She always comes in after me.",
        ],
      },
      { id: "remember", text: "I remember each turn before it happens. That part never fails me." },
      {
        id: "say",
        variants: [
          "I tell her to stay. She stays.",
          "I tell her to go. She goes, and the rain starts.",
          "I say nothing at all. That's the loop I can't get out of.",
        ],
      },
      {
        id: "count",
        variants: [
          "I've lived it forty times. I counted.",
          "I've lived it twice. Only twice. The rest I imagined.",
          "I've lived it once. Everything after is the once, remembered louder.",
        ],
      },
      {
        id: "exit",
        variants: [
          "There's no way out. I've checked every door.",
          "There's one way out. I take it every time and it brings me back.",
        ],
      },
      { id: "ask-again", text: "So ask me again. It's the only thing that's ever moved anything." },
    ],
    resolution:
      "A loop is just a lie about time, and a lie can't keep its hands still.\n\nThe clock changed. The count changed. The thing he told her changed, which is the only one that ever mattered. A man living the same night forty times would have it memorized to the second. He had it memorized to the feeling, and the feeling rewrote the seconds each pass.\n\nIt wasn't a loop. It was once. Once, and a door he said nothing at, and every telling since has been him standing in that doorway trying a different word. An arrow travels in only one direction. He has been firing the same one into the dark, calling each landing a new night.",
  },
];
