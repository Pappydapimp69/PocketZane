/**
 * The subject's behavior under questioning — short, neutral "tells" surfaced as
 * feedback so each action reads like pressure on a person (or a thing), not a
 * status code. Pronoun-free on purpose: the chair doesn't always hold a person.
 */
type Event =
  | "againMoved"
  | "againHeld"
  | "pressUseful"
  | "pressBarren"
  | "pinned"
  | "notYet"
  | "falseStrike"
  | "recovered"
  | "deflate";

const LINES: Record<Event, string[]> = {
  againMoved: [
    "A word lands differently this time.",
    "Something in it shifts.",
    "The account moves under its own weight.",
    "That wasn't quite how it went before.",
  ],
  againHeld: ["It holds, that time.", "Nothing gives.", "The same, word for word.", "Steady. Unmoved."],
  pressUseful: [
    "You hold the question there. The seams strain.",
    "Pressed. It'll be harder to keep straight.",
    "You lean in. The story tightens, then frays.",
  ],
  pressBarren: [
    "Nothing gives. Maybe there's nothing there.",
    "It doesn't move. Some things are simply true.",
    "No give. You're leaning on stone.",
  ],
  pinned: ["Pinned. It can't take that back.", "Caught. The record keeps it now.", "That one is yours."],
  notYet: [
    "You haven't seen it move. Make it tell again.",
    "No proof yet. Ask again, or find the fact.",
    "Catch it shifting first.",
  ],
  falseStrike: [
    "That one was true. Composure returns.",
    "You accused the truth. It steadies.",
    "Nothing there — and now it knows you blinked.",
  ],
  recovered: [
    "It gathers itself. What you'd worked loose tightens.",
    "Composure returns. The seams close.",
    "Too hard, too fast — it steadies.",
  ],
  deflate: [
    "There's nothing there. You're hearing what you want to hear.",
    "Press all night. Stone doesn't crack because you need it to.",
    "Some lines are just true. You keep leaning on this one.",
  ],
};

export function tell(event: Event): string {
  const pool = LINES[event];
  return pool[Math.floor(Math.random() * pool.length)];
}
