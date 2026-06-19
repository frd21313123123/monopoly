export interface Token {
  id: string;
  nameKey: string;
  symbol: string;
  color: string;
}

export const TOKENS: readonly Token[] = [
  { id: 'hat', nameKey: 'token.hat', symbol: '🎩', color: '#2c2c2c' },
  { id: 'car', nameKey: 'token.car', symbol: '🚗', color: '#c92020' },
  { id: 'dog', nameKey: 'token.dog', symbol: '🐕', color: '#8a5a2b' },
  { id: 'boot', nameKey: 'token.boot', symbol: '🥾', color: '#5a3320' },
  { id: 'ship', nameKey: 'token.ship', symbol: '🚢', color: '#1e4a86' },
  { id: 'cat', nameKey: 'token.cat', symbol: '🐈', color: '#e6a100' },
  { id: 'rocket', nameKey: 'token.rocket', symbol: '🚀', color: '#7d2d8a' },
  { id: 'unicorn', nameKey: 'token.unicorn', symbol: '🦄', color: '#d63a96' },
];

export const MAX_PLAYERS = TOKENS.length;
export const MIN_PLAYERS = 2;

/**
 * Palette a player can pick from to recolor their 3D pawn / marker.
 *
 * Ordered most-distinct-first: a 2–4 player game pulls the first few entries,
 * which are maximally separated in hue (red / blue / green / orange…) so pawns
 * and owner markers never blend into each other or the board. There are exactly
 * `MAX_PLAYERS` (8) entries, so every seat gets a unique, well-separated color.
 */
export const TOKEN_COLORS: readonly string[] = [
  '#e6194b', // red
  '#4363d8', // blue
  '#3cb44b', // green
  '#f58231', // orange
  '#911eb4', // purple
  '#f032e6', // magenta
  '#00b4c8', // cyan
  '#ffd000', // gold
];

export function getToken(id: string): Token | undefined {
  return TOKENS.find((t) => t.id === id);
}

/** Resolves a player's pawn color: their chosen color, else the token default. */
export function playerColor(player: { tokenId: string; color?: string }): string {
  return player.color ?? getToken(player.tokenId)?.color ?? '#888';
}

/**
 * Picks the first palette color not already in use. Used to auto-assign a
 * distinct color to a joining network player (preferring their requested one),
 * guaranteeing no two players share a shade. Falls back to the first palette
 * entry if every color is somehow taken (can't happen at ≤ MAX_PLAYERS).
 */
export function nextDistinctColor(
  used: Iterable<string>,
  preferred?: string,
): string {
  const taken = new Set(used);
  if (preferred && TOKEN_COLORS.includes(preferred) && !taken.has(preferred)) {
    return preferred;
  }
  for (const color of TOKEN_COLORS) {
    if (!taken.has(color)) return color;
  }
  return TOKEN_COLORS[0]!;
}
