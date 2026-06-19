import { createPlayer, initialState, type Action, type GameState } from '@monopoly/core';
import { describe, expect, it } from 'vitest';
import { canSubmitAction } from './authorize.js';

const HOST = 'host-id';
const P2 = 'p2-id';
const P3 = 'p3-id';

function baseState(patch: Partial<GameState> = {}): GameState {
  return {
    ...initialState(1),
    phase: 'playing',
    players: [
      { ...createPlayer(HOST, 'Host', 'hat') },
      { ...createPlayer(P2, 'Two', 'car') },
      { ...createPlayer(P3, 'Three', 'dog') },
    ],
    currentPlayerIndex: 0,
    ...patch,
  };
}

describe('lobby actions — host only', () => {
  const lobbyActions: Action[] = [
    { type: 'lobby/addPlayer', name: 'X', tokenId: 'ship' },
    { type: 'lobby/removePlayer', playerId: P2 },
    { type: 'lobby/startGame' },
  ];

  it.each(lobbyActions)('host may submit $type', (action) => {
    expect(canSubmitAction(baseState(), HOST, action)).toBe(true);
  });

  it.each(lobbyActions)('non-host may not submit $type', (action) => {
    expect(canSubmitAction(baseState(), P2, action)).toBe(false);
  });
});

describe('turn/manage/jail/debt actions — current player only', () => {
  const actions: Action[] = [
    { type: 'turn/rollAndMove' },
    { type: 'turn/buyCurrent' },
    { type: 'turn/declinePurchase' },
    { type: 'turn/auctionCurrent' },
    { type: 'turn/offerPurchase', toPlayerId: P2, price: 100 },
    { type: 'turn/end' },
    { type: 'manage/buyHouse', tileIndex: 1 },
    { type: 'manage/sellHouse', tileIndex: 1 },
    { type: 'manage/mortgage', tileIndex: 1 },
    { type: 'manage/unmortgage', tileIndex: 1 },
    { type: 'jail/roll' },
    { type: 'jail/payFine' },
    { type: 'jail/useCard' },
    { type: 'debt/pay' },
    { type: 'debt/declareBankruptcy' },
  ];

  it.each(actions)('current player may submit $type', (action) => {
    expect(canSubmitAction(baseState({ currentPlayerIndex: 1 }), P2, action)).toBe(true);
  });

  it.each(actions)('other players may not submit $type', (action) => {
    const state = baseState({ currentPlayerIndex: 1 });
    expect(canSubmitAction(state, HOST, action)).toBe(false);
    expect(canSubmitAction(state, P3, action)).toBe(false);
  });
});

describe('auction actions', () => {
  function auctionState(turnIndex: number): GameState {
    return baseState({
      pendingAuction: {
        tileIndex: 1,
        currentBid: 0,
        highBidderId: null,
        activePlayerIds: [HOST, P2, P3],
        turnIndex,
      },
    });
  }

  it('the auction turn-holder may bid/pass with matching playerId', () => {
    const state = auctionState(1); // P2's turn
    expect(canSubmitAction(state, P2, { type: 'auction/bid', playerId: P2, amount: 10 })).toBe(true);
    expect(canSubmitAction(state, P2, { type: 'auction/pass', playerId: P2 })).toBe(true);
  });

  it('rejects when it is not the submitter’s auction turn', () => {
    const state = auctionState(1); // P2's turn
    expect(canSubmitAction(state, HOST, { type: 'auction/bid', playerId: HOST, amount: 10 })).toBe(
      false,
    );
  });

  it('rejects when the action playerId does not match the submitter', () => {
    const state = auctionState(1);
    expect(canSubmitAction(state, P2, { type: 'auction/bid', playerId: P3, amount: 10 })).toBe(
      false,
    );
  });

  it('rejects when there is no pending auction', () => {
    expect(
      canSubmitAction(baseState(), HOST, { type: 'auction/bid', playerId: HOST, amount: 10 }),
    ).toBe(false);
  });
});

describe('trade actions', () => {
  const emptyBundle = { tiles: [], money: 0, jailFreeCards: 0 };

  it('trade/propose allowed only for the from-player', () => {
    const action: Action = {
      type: 'trade/propose',
      fromPlayerId: HOST,
      toPlayerId: P2,
      fromOffer: emptyBundle,
      toOffer: emptyBundle,
    };
    expect(canSubmitAction(baseState(), HOST, action)).toBe(true);
    expect(canSubmitAction(baseState(), P2, action)).toBe(false);
  });

  it('trade/accept and trade/decline allowed only for the to-player', () => {
    const state = baseState({
      pendingTrade: {
        fromPlayerId: HOST,
        toPlayerId: P2,
        fromOffer: emptyBundle,
        toOffer: emptyBundle,
      },
    });
    expect(canSubmitAction(state, P2, { type: 'trade/accept' })).toBe(true);
    expect(canSubmitAction(state, P2, { type: 'trade/decline' })).toBe(true);
    expect(canSubmitAction(state, HOST, { type: 'trade/accept' })).toBe(false);
  });

  it('trade/accept rejected when there is no pending trade', () => {
    expect(canSubmitAction(baseState(), P2, { type: 'trade/accept' })).toBe(false);
  });
});

describe('offer actions', () => {
  it('offer/accept and offer/decline allowed only for the offered-to player', () => {
    const state = baseState({
      pendingOffer: {
        tileIndex: 1,
        fromPlayerId: HOST,
        toPlayerId: P2,
        price: 100,
        originalPrice: 60,
      },
    });
    expect(canSubmitAction(state, P2, { type: 'offer/accept' })).toBe(true);
    expect(canSubmitAction(state, P2, { type: 'offer/decline' })).toBe(true);
    expect(canSubmitAction(state, HOST, { type: 'offer/accept' })).toBe(false);
  });

  it('offer/accept rejected when there is no pending offer', () => {
    expect(canSubmitAction(baseState(), P2, { type: 'offer/accept' })).toBe(false);
  });
});
