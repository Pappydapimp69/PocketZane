/**
 * Standard-gamepad button indices (Xbox-style; PlayStation maps the same slots:
 * cross=A, circle=B, square=X, triangle=Y). Used by the scenes so the mapping
 * lives in one place.
 */
export const PAD = {
  A: 0, // again
  B: 1, // back / deselect
  X: 2, // press (alt)
  Y: 3, // pin (alt)
  LB: 4, // ledger
  RB: 5,
  LT: 6, // press
  RT: 7, // pin
  START: 9, // leave
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

/** Left-stick deadzone for treating a tilt as a discrete step. */
export const STICK_THRESHOLD = 0.5;
/** Minimum ms between repeated stick steps. */
export const STICK_REPEAT_MS = 200;
