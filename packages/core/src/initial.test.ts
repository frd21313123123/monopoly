import { describe, expect, it } from 'vitest';
import { createPlayer, GO_BONUS, initialState, STARTING_MONEY } from './initial.js';

describe('initialState', () => {
  it('starts in the lobby with no players', () => {
    const s = initialState(42);
    expect(s.phase).toBe('lobby');
    expect(s.players).toEqual([]);
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.turn).toBe(0);
  });

  it('stores the seed (coerced to uint32) as rngState', () => {
    expect(initialState(42).rngState).toBe(42);
    expect(initialState(-1).rngState).toBe(0xffffffff);
  });

  it('initializes all pending flags clear', () => {
    const s = initialState(1);
    expect(s.pendingPurchase).toBeNull();
    expect(s.pendingOffer).toBeNull();
    expect(s.pendingAuction).toBeNull();
    expect(s.pendingTrade).toBeNull();
    expect(s.pendingDebt).toBeNull();
    expect(s.pendingEndTurn).toBe(false);
  });

  it('starts with empty boards, decks, and logs', () => {
    const s = initialState(1);
    expect(s.buildings).toEqual({});
    expect(s.mortgaged).toEqual([]);
    expect(s.chanceDeck).toEqual([]);
    expect(s.chestDeck).toEqual([]);
    expect(s.log).toEqual([]);
    expect(s.logSeq).toBe(0);
    expect(s.rollSeq).toBe(0);
    expect(s.lastRoll).toBeNull();
  });

  it('uses a default seed when none given', () => {
    expect(typeof initialState().rngState).toBe('number');
  });
});

describe('createPlayer', () => {
  it('creates a player with starting defaults', () => {
    const p = createPlayer('id1', 'Алиса', 'hat');
    expect(p).toEqual({
      id: 'id1',
      name: 'Алиса',
      tokenId: 'hat',
      position: 0,
      money: STARTING_MONEY,
      inJail: false,
      jailTurns: 0,
      ownedTiles: [],
      jailFreeCards: 0,
      bankrupt: false,
    });
  });

  it('exposes the right constants', () => {
    expect(STARTING_MONEY).toBe(1500);
    expect(GO_BONUS).toBe(200);
  });
});
