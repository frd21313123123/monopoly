import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, MIN_PLAYERS, TOKEN_COLORS, TOKENS, getToken, playerColor } from './tokens.js';

describe('TOKENS', () => {
  it('has 8 tokens', () => {
    expect(TOKENS).toHaveLength(8);
  });

  it('each token has unique id and the expected shape', () => {
    const ids = new Set<string>();
    for (const tok of TOKENS) {
      expect(tok.id).toBeTruthy();
      expect(tok.nameKey.startsWith('token.')).toBe(true);
      expect(tok.symbol).toBeTruthy();
      expect(tok.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      ids.add(tok.id);
    }
    expect(ids.size).toBe(TOKENS.length);
  });

  it('MAX_PLAYERS equals token count, MIN_PLAYERS is 2', () => {
    expect(MAX_PLAYERS).toBe(TOKENS.length);
    expect(MIN_PLAYERS).toBe(2);
  });
});

describe('getToken', () => {
  it('returns the matching token', () => {
    expect(getToken('hat')?.symbol).toBe('🎩');
  });

  it('returns undefined for an unknown id', () => {
    expect(getToken('nope')).toBeUndefined();
  });
});

describe('TOKEN_COLORS', () => {
  it('are all valid unique hex colors', () => {
    const seen = new Set<string>();
    for (const c of TOKEN_COLORS) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(TOKEN_COLORS.length);
  });
});

describe('playerColor', () => {
  it('returns the chosen color when set', () => {
    expect(playerColor({ tokenId: 'hat', color: '#1e88e5' })).toBe('#1e88e5');
  });

  it('falls back to the token default color', () => {
    expect(playerColor({ tokenId: 'hat' })).toBe(getToken('hat')?.color);
  });

  it('falls back to a neutral color for an unknown token', () => {
    expect(playerColor({ tokenId: 'nope' })).toBe('#888');
  });
});
