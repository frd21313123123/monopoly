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

export function getToken(id: string): Token | undefined {
  return TOKENS.find((t) => t.id === id);
}
