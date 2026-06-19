import { describe, expect, it } from 'vitest';
import { createPlayer, initialState } from './initial.js';
import {
  computeRent,
  countStationsOwned,
  countUtilitiesOwned,
  findOwner,
  isPurchasable,
  ownsFullGroup,
  tilePrice,
} from './ownership.js';
import { HOTEL_LEVEL, type GameState, type Player } from './types.js';

function withPlayers(players: Player[], patch: Partial<GameState> = {}): GameState {
  return { ...initialState(1), phase: 'playing', players, ...patch };
}

function player(id: string, ownedTiles: number[], patch: Partial<Player> = {}): Player {
  return { ...createPlayer(id, id, 'hat'), ownedTiles, ...patch };
}

describe('findOwner', () => {
  it('returns the player owning a tile', () => {
    const p = player('a', [1, 3]);
    const state = withPlayers([p]);
    expect(findOwner(state, 1)).toBe(p);
    expect(findOwner(state, 3)).toBe(p);
  });

  it('returns null when nobody owns the tile', () => {
    const state = withPlayers([player('a', [1])]);
    expect(findOwner(state, 5)).toBeNull();
  });

  it('ignores bankrupt owners', () => {
    const state = withPlayers([player('a', [1], { bankrupt: true })]);
    expect(findOwner(state, 1)).toBeNull();
  });
});

describe('ownsFullGroup', () => {
  it('true only when all group tiles are owned (brown = 1,3)', () => {
    expect(ownsFullGroup(player('a', [1, 3]), 1)).toBe(true);
    expect(ownsFullGroup(player('a', [1]), 1)).toBe(false);
  });

  it('false for non-street tiles', () => {
    expect(ownsFullGroup(player('a', [5]), 5)).toBe(false); // station
  });
});

describe('countStationsOwned / countUtilitiesOwned', () => {
  it('counts owned stations', () => {
    expect(countStationsOwned(player('a', [5, 15, 1]))).toBe(2);
    expect(countStationsOwned(player('a', []))).toBe(0);
  });

  it('counts owned utilities', () => {
    expect(countUtilitiesOwned(player('a', [12, 28]))).toBe(2);
    expect(countUtilitiesOwned(player('a', [12]))).toBe(1);
  });
});

describe('computeRent — streets', () => {
  it('base rent with no monopoly', () => {
    const state = withPlayers([player('a', [1])]); // Marosejka base 2
    expect(computeRent(state, 1, 7)).toEqual({ owner: state.players[0], amount: 2 });
  });

  it('doubled base rent with full monopoly and no houses', () => {
    const state = withPlayers([player('a', [1, 3])]); // brown monopoly
    expect(computeRent(state, 1, 7)!.amount).toBe(4); // mono = base*2
  });

  it('uses the house ladder', () => {
    const state = withPlayers([player('a', [1, 3])], { buildings: { 1: 3 } });
    expect(computeRent(state, 1, 7)!.amount).toBe(90); // h3 of Marosejka
  });

  it('uses the hotel rate', () => {
    const state = withPlayers([player('a', [1, 3])], { buildings: { 1: HOTEL_LEVEL } });
    expect(computeRent(state, 1, 7)!.amount).toBe(250); // hotel of Marosejka
  });

  it('returns null for a mortgaged tile', () => {
    const state = withPlayers([player('a', [1])], { mortgaged: [1] });
    expect(computeRent(state, 1, 7)).toBeNull();
  });

  it('returns null for an unowned tile', () => {
    expect(computeRent(withPlayers([player('a', [])]), 1, 7)).toBeNull();
  });
});

describe('computeRent — stations', () => {
  it('25 * 2^(n-1) by stations owned', () => {
    const one = withPlayers([player('a', [5])]);
    expect(computeRent(one, 5, 7)!.amount).toBe(25);
    const two = withPlayers([player('a', [5, 15])]);
    expect(computeRent(two, 5, 7)!.amount).toBe(50);
    const four = withPlayers([player('a', [5, 15, 25, 35])]);
    expect(computeRent(four, 5, 7)!.amount).toBe(200);
  });
});

describe('computeRent — utilities', () => {
  it('4x dice with one utility', () => {
    const state = withPlayers([player('a', [12])]);
    expect(computeRent(state, 12, 9)!.amount).toBe(36);
  });

  it('10x dice with both utilities', () => {
    const state = withPlayers([player('a', [12, 28])]);
    expect(computeRent(state, 12, 9)!.amount).toBe(90);
  });
});

describe('isPurchasable', () => {
  it('true for street/station/utility', () => {
    expect(isPurchasable(1)).toBe(true); // street
    expect(isPurchasable(5)).toBe(true); // station
    expect(isPurchasable(12)).toBe(true); // utility
  });

  it('false for non-property tiles', () => {
    expect(isPurchasable(0)).toBe(false); // GO
    expect(isPurchasable(2)).toBe(false); // chest
    expect(isPurchasable(4)).toBe(false); // tax
    expect(isPurchasable(10)).toBe(false); // jail
  });
});

describe('tilePrice', () => {
  it('returns the price of purchasable tiles', () => {
    expect(tilePrice(1)).toBe(60);
    expect(tilePrice(5)).toBe(200);
    expect(tilePrice(12)).toBe(150);
  });

  it('returns 0 for non-purchasable tiles', () => {
    expect(tilePrice(0)).toBe(0);
    expect(tilePrice(4)).toBe(0);
  });
});
