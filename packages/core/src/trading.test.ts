import { describe, expect, it } from 'vitest';
import { initialState, STARTING_MONEY } from './initial.js';
import { reduce } from './reducer.js';
import { getTile, BOARD_SIZE } from './board.js';
import { findOwner } from './ownership.js';
import { mortgageValue, unmortgageCost } from './trading.js';
import { rollDicePure } from './rng/dice.js';
import { TileKind, type GameState } from './types.js';

function setup(seed = 99): GameState {
  let s = initialState(seed);
  s = reduce(s, { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
  s = reduce(s, { type: 'lobby/addPlayer', name: 'B', tokenId: 'car' });
  return reduce(s, { type: 'lobby/startGame' });
}

function setupThree(): GameState {
  let s = initialState(99);
  s = reduce(s, { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
  s = reduce(s, { type: 'lobby/addPlayer', name: 'B', tokenId: 'car' });
  s = reduce(s, { type: 'lobby/addPlayer', name: 'C', tokenId: 'dog' });
  return reduce(s, { type: 'lobby/startGame' });
}

function giveOwnership(s: GameState, playerIndex: number, tiles: number[]): GameState {
  return {
    ...s,
    players: s.players.map((p, i) => (i === playerIndex ? { ...p, ownedTiles: tiles } : p)),
  };
}

function findSeedForSum(sum: number): number {
  const mustDouble = sum === 2 || sum === 12;
  for (let s = 1; s < 500000; s++) {
    const { roll } = rollDicePure(s);
    if (roll.sum === sum && (mustDouble || !roll.isDouble)) return s;
  }
  throw new Error(`No seed for sum ${sum}`);
}

function landAt(s: GameState, target: number, playerIndex = 0): GameState {
  for (let sum = 3; sum <= 11; sum++) {
    const start = ((target - sum) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
    if (start > target) continue;
    const seed = findSeedForSum(sum);
    const placed = {
      ...s,
      players: s.players.map((p, i) => (i === playerIndex ? { ...p, position: start } : p)),
      rngState: seed,
    };
    return reduce(placed, { type: 'turn/rollAndMove' });
  }
  throw new Error('cannot reach');
}

describe('mortgage', () => {
  it('mortgaging a street refunds half the price', () => {
    let s = setup();
    s = giveOwnership(s, 0, [1]);
    const before = s.players[0]!.money;
    s = reduce(s, { type: 'manage/mortgage', tileIndex: 1 });
    expect(s.mortgaged).toContain(1);
    expect(s.players[0]!.money).toBe(before + mortgageValue(1));
  });

  it('cannot mortgage when buildings exist in the group', () => {
    let s = setup();
    s = giveOwnership(s, 0, [1, 3]);
    s = { ...s, buildings: { 1: 2 } };
    const next = reduce(s, { type: 'manage/mortgage', tileIndex: 3 });
    expect(next).toBe(s);
  });

  it('unmortgaging costs +10% interest', () => {
    let s = setup();
    s = giveOwnership(s, 0, [1]);
    s = reduce(s, { type: 'manage/mortgage', tileIndex: 1 });
    const moneyBefore = s.players[0]!.money;
    s = reduce(s, { type: 'manage/unmortgage', tileIndex: 1 });
    expect(s.mortgaged).not.toContain(1);
    expect(s.players[0]!.money).toBe(moneyBefore - unmortgageCost(1));
  });

  it('mortgaged tile yields no rent when landed on', () => {
    let s = setup();
    s = giveOwnership(s, 1, [3]);
    s = { ...s, mortgaged: [3] };
    s = landAt(s, 3, 0);
    expect(s.players[0]!.money).toBe(STARTING_MONEY);
  });
});

describe('auction', () => {
  it('declining purchase does NOT start an auction', () => {
    let s = setup();
    s = landAt(s, 5);
    expect(s.pendingPurchase).not.toBeNull();
    s = reduce(s, { type: 'turn/declinePurchase' });
    expect(s.pendingPurchase).toBeNull();
    expect(s.pendingAuction).toBeNull();
  });

  it('auctionCurrent starts an auction for the current tile', () => {
    let s = setup();
    s = landAt(s, 5);
    expect(s.pendingPurchase).not.toBeNull();
    s = reduce(s, { type: 'turn/auctionCurrent' });
    expect(s.pendingPurchase).toBeNull();
    expect(s.pendingAuction).not.toBeNull();
    expect(s.pendingAuction!.tileIndex).toBe(5);
  });

  it('bid raises currentBid and rotates turn', () => {
    let s = setup();
    s = landAt(s, 5);
    s = reduce(s, { type: 'turn/auctionCurrent' });
    const firstBidder = s.pendingAuction!.activePlayerIds[0]!;
    s = reduce(s, { type: 'auction/bid', playerId: firstBidder, amount: 50 });
    expect(s.pendingAuction!.currentBid).toBe(50);
    expect(s.pendingAuction!.highBidderId).toBe(firstBidder);
  });

  it('bids below min increment are rejected', () => {
    let s = setup();
    s = landAt(s, 5);
    s = reduce(s, { type: 'turn/auctionCurrent' });
    const firstBidder = s.pendingAuction!.activePlayerIds[0]!;
    s = reduce(s, { type: 'auction/bid', playerId: firstBidder, amount: 50 });
    const before = s;
    // Second player tries to bid 55 (need at least 60)
    const secondId = s.pendingAuction!.activePlayerIds[s.pendingAuction!.turnIndex]!;
    s = reduce(s, { type: 'auction/bid', playerId: secondId, amount: 55 });
    expect(s).toBe(before);
  });

  it('all-pass with no bid ends auction without winner', () => {
    let s = setup();
    s = landAt(s, 5);
    s = reduce(s, { type: 'turn/auctionCurrent' });
    const a = s.pendingAuction!.activePlayerIds;
    for (const pid of a) {
      s = reduce(s, { type: 'auction/pass', playerId: pid });
    }
    expect(s.pendingAuction).toBeNull();
    expect(findOwner(s, 5)).toBeNull();
  });

  it('single high bidder wins and pays', () => {
    let s = setupThree();
    s = landAt(s, 5);
    s = reduce(s, { type: 'turn/auctionCurrent' });
    const auction = s.pendingAuction!;
    const bidderId = auction.activePlayerIds[0]!;
    s = reduce(s, { type: 'auction/bid', playerId: bidderId, amount: 100 });
    // Other 2 pass
    let safety = 0;
    while (s.pendingAuction && safety < 10) {
      const currentTurn = s.pendingAuction.turnIndex;
      const pid = s.pendingAuction.activePlayerIds[currentTurn]!;
      s = reduce(s, { type: 'auction/pass', playerId: pid });
      safety++;
    }
    expect(s.pendingAuction).toBeNull();
    expect(findOwner(s, 5)?.id).toBe(bidderId);
    const winner = s.players.find((p) => p.id === bidderId)!;
    expect(winner.money).toBe(STARTING_MONEY - 100);
  });
});

describe('trade', () => {
  it('propose + accept exchanges tiles and money', () => {
    let s = setup();
    s = giveOwnership(s, 0, [1]);
    s = giveOwnership(s, 1, [3]);
    s = reduce(s, {
      type: 'trade/propose',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      fromOffer: { tiles: [1], money: 50, jailFreeCards: 0 },
      toOffer: { tiles: [3], money: 0, jailFreeCards: 0 },
    });
    expect(s.pendingTrade).not.toBeNull();
    s = reduce(s, { type: 'trade/accept' });
    expect(s.pendingTrade).toBeNull();
    expect(s.players[0]!.ownedTiles).toContain(3);
    expect(s.players[0]!.ownedTiles).not.toContain(1);
    expect(s.players[1]!.ownedTiles).toContain(1);
    expect(s.players[0]!.money).toBe(STARTING_MONEY - 50);
    expect(s.players[1]!.money).toBe(STARTING_MONEY + 50);
  });

  it('rejects propose if from-player does not own offered tile', () => {
    let s = setup();
    const before = s;
    s = reduce(s, {
      type: 'trade/propose',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      fromOffer: { tiles: [1], money: 0, jailFreeCards: 0 },
      toOffer: { tiles: [], money: 0, jailFreeCards: 0 },
    });
    expect(s).toBe(before);
  });

  it('decline clears pendingTrade without changes', () => {
    let s = setup();
    s = giveOwnership(s, 0, [1]);
    s = reduce(s, {
      type: 'trade/propose',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      fromOffer: { tiles: [1], money: 0, jailFreeCards: 0 },
      toOffer: { tiles: [], money: 100, jailFreeCards: 0 },
    });
    s = reduce(s, { type: 'trade/decline' });
    expect(s.pendingTrade).toBeNull();
    expect(s.players[0]!.ownedTiles).toContain(1);
    expect(s.players[0]!.money).toBe(STARTING_MONEY);
  });

  it('rejects trade involving a tile in a group with buildings', () => {
    let s = setup();
    s = giveOwnership(s, 0, [1, 3]);
    s = { ...s, buildings: { 1: 1 } };
    const before = s;
    s = reduce(s, {
      type: 'trade/propose',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      fromOffer: { tiles: [3], money: 0, jailFreeCards: 0 },
      toOffer: { tiles: [], money: 100, jailFreeCards: 0 },
    });
    expect(s).toBe(before);
  });

  it('jail-free cards can be traded', () => {
    let s = setup();
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, jailFreeCards: 1 } : p)),
    };
    s = reduce(s, {
      type: 'trade/propose',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      fromOffer: { tiles: [], money: 0, jailFreeCards: 1 },
      toOffer: { tiles: [], money: 100, jailFreeCards: 0 },
    });
    s = reduce(s, { type: 'trade/accept' });
    expect(s.players[0]!.jailFreeCards).toBe(0);
    expect(s.players[1]!.jailFreeCards).toBe(1);
    expect(s.players[0]!.money).toBe(STARTING_MONEY + 100);
    expect(s.players[1]!.money).toBe(STARTING_MONEY - 100);
  });
});

