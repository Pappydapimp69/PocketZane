/**
 * Canvas dimensions, in their own leaf module (no imports) so scenes can read
 * them at module-evaluation time without a circular dependency on config.ts
 * (which imports the scenes).
 */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;
