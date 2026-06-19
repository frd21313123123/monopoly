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

/** Palette a player can pick from to recolor their 3D pawn / marker. */
export const TOKEN_COLORS: readonly string[] = [
  '#c92020',
  '#e6a100',
  '#3aa655',
  '#1e88e5',
  '#7d2d8a',
  '#d63a96',
  '#00897b',
  '#5a3320',
  '#2c2c2c',
  '#9e9e9e',
];

export function getToken(id: string): Token | undefined {
  return TOKENS.find((t) => t.id === id);
}

/** Resolves a player's pawn color: their chosen color, else the token default. */
export function playerColor(player: { tokenId: string; color?: string }): string {
  return player.color ?? getToken(player.tokenId)?.color ?? '#888';
}
