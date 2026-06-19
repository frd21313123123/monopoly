import { describe, expect, it, vi } from 'vitest';
import { applyCardEffect, type CardEffectContext } from './card-effects.js';
import { JAIL_INDEX } from './board.js';
import { createPlayer, GO_BONUS, initialState } from './initial.js';
import type { CardEffect } from './cards.js';
import { HOTEL_LEVEL, type GameState, type Player } from './types.js';

function withPlayers(players: Player[], patch: Partial<GameState> = {}): GameState {
  return { ...initialState(1), phase: 'playing', players, ...patch };
}

function player(id: string, patch: Partial<Player> = {}): Player {
  return { ...createPlayer(id, id, 'hat'), ...patch };
}

function money(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)!.money;
}

/**
 * A test context: payHandler moves money between balances (bank when payee null),
 * landingHandler is a spy that returns the state unchanged, appendLog appends.
 */
function makeCtx(diceSum = 7): CardEffectContext & {
  landing: ReturnType<typeof vi.fn>;
} {
  const landing = vi.fn((state: GameState) => state);
  return {
    diceSum,
    landing,
    landingHandler: landing,
    payHandler: (state, payerId, payeeId, amount) => ({
      ...state,
      players: state.players.map((p) => {
        if (p.id === payerId) return { ...p, money: p.money - amount };
        if (payeeId && p.id === payeeId) return { ...p, money: p.money + amount };
        return p;
      }),
    }),
    appendLog: (state, entries) => ({ ...state, log: [...state.log, ...entries] }),
    addWaypoint: (state, tileIndex) =>
      state.lastMove
        ? { ...state, lastMove: { ...state.lastMove, path: [...state.lastMove.path, tileIndex] } }
        : state,
  };
}

describe('applyCardEffect — money', () => {
  it('collectBank credits the player', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { money: 100 })]);
    const next = applyCardEffect(state, 'a', { kind: 'collectBank', amount: 150 }, ctx);
    expect(money(next, 'a')).toBe(250);
  });

  it('payBank debits via payHandler', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { money: 100 })]);
    const next = applyCardEffect(state, 'a', { kind: 'payBank', amount: 15 }, ctx);
    expect(money(next, 'a')).toBe(85);
  });

  it('collectEach takes from every other non-bankrupt player', () => {
    const ctx = makeCtx();
    const state = withPlayers([
      player('a', { money: 100 }),
      player('b', { money: 100 }),
      player('c', { money: 100, bankrupt: true }),
    ]);
    const next = applyCardEffect(state, 'a', { kind: 'collectEach', amount: 10 }, ctx);
    expect(money(next, 'a')).toBe(110); // only b pays
    expect(money(next, 'b')).toBe(90);
    expect(money(next, 'c')).toBe(100);
  });

  it('payEach pays every other player when affordable', () => {
    const ctx = makeCtx();
    const state = withPlayers([
      player('a', { money: 500 }),
      player('b', { money: 0 }),
      player('c', { money: 0 }),
    ]);
    const next = applyCardEffect(state, 'a', { kind: 'payEach', amount: 50 }, ctx);
    expect(money(next, 'a')).toBe(400);
    expect(money(next, 'b')).toBe(50);
    expect(money(next, 'c')).toBe(50);
  });

  it('payEach falls back to a bank debt when the player cannot afford the total', () => {
    const ctx = makeCtx();
    const state = withPlayers([
      player('a', { money: 30 }),
      player('b', { money: 0 }),
      player('c', { money: 0 }),
    ]);
    const next = applyCardEffect(state, 'a', { kind: 'payEach', amount: 50 }, ctx);
    // cannot afford 100 -> single payHandler to bank for the full total
    expect(money(next, 'a')).toBe(30 - 100);
    expect(money(next, 'b')).toBe(0);
    expect(money(next, 'c')).toBe(0);
  });
});

describe('applyCardEffect — movement', () => {
  it('moveTo without passing GO does not pay the bonus and lands', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 5, money: 100 })]);
    const next = applyCardEffect(state, 'a', { kind: 'moveTo', tileIndex: 11, collectGo: true }, ctx);
    expect(next.players[0]!.position).toBe(11);
    expect(money(next, 'a')).toBe(100); // 11 > 5, no GO pass
    expect(ctx.landing).toHaveBeenCalledWith(expect.anything(), 'a', 11, 7, 1, false);
  });

  it('moveTo pays GO bonus when target is behind the player', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 30, money: 100 })]);
    const next = applyCardEffect(state, 'a', { kind: 'moveTo', tileIndex: 5, collectGo: true }, ctx);
    expect(next.players[0]!.position).toBe(5);
    expect(money(next, 'a')).toBe(100 + GO_BONUS);
  });

  it('moveTo with collectGo=false never pays the bonus', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 30, money: 100 })]);
    const next = applyCardEffect(state, 'a', { kind: 'moveTo', tileIndex: 5, collectGo: false }, ctx);
    expect(money(next, 'a')).toBe(100);
  });

  it('moveRelative wraps around the board', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 1 })]);
    const next = applyCardEffect(state, 'a', { kind: 'moveRelative', delta: -3 }, ctx);
    expect(next.players[0]!.position).toBe(38);
  });

  it('moveToNearestStation moves ahead and doubles rent', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 7 })]);
    const next = applyCardEffect(state, 'a', { kind: 'moveToNearestStation', payDouble: true }, ctx);
    expect(next.players[0]!.position).toBe(15); // nearest station ahead of 7
    expect(ctx.landing).toHaveBeenCalledWith(expect.anything(), 'a', 15, 7, 2, false);
  });

  it('records the destination as an animation waypoint', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 7 })], {
      lastMove: { playerId: 'a', path: [7], seq: 1 },
    });
    const next = applyCardEffect(state, 'a', { kind: 'moveToNearestStation', payDouble: false }, ctx);
    // The dice tile (7) plus the card redirect (15) so the client animates the leg.
    expect(next.lastMove!.path).toEqual([7, 15]);
  });

  it('moveToNearestUtility forces the 10x rule', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 7 })]);
    const next = applyCardEffect(state, 'a', { kind: 'moveToNearestUtility' }, ctx);
    expect(next.players[0]!.position).toBe(12);
    expect(ctx.landing).toHaveBeenCalledWith(expect.anything(), 'a', 12, 7, 1, true);
  });
});

describe('applyCardEffect — jail & cards', () => {
  it('goToJail sets jail state and clears doubles', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { position: 22 })], { doublesThisTurn: 2 });
    const next = applyCardEffect(state, 'a', { kind: 'goToJail' }, ctx);
    expect(next.players[0]!.position).toBe(JAIL_INDEX);
    expect(next.players[0]!.inJail).toBe(true);
    expect(next.players[0]!.jailTurns).toBe(0);
    expect(next.doublesThisTurn).toBe(0);
    expect(ctx.landing).not.toHaveBeenCalled();
  });

  it('getOutOfJailFree adds a card', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { jailFreeCards: 0 })]);
    const next = applyCardEffect(
      state,
      'a',
      { kind: 'getOutOfJailFree', deck: 'CHANCE' },
      ctx,
    );
    expect(next.players[0]!.jailFreeCards).toBe(1);
  });
});

describe('applyCardEffect — repairs', () => {
  it('charges per house and per hotel', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { money: 1000, ownedTiles: [1, 3] })], {
      buildings: { 1: 2, 3: HOTEL_LEVEL },
    });
    const effect: CardEffect = { kind: 'payRepairs', perHouse: 25, perHotel: 100 };
    const next = applyCardEffect(state, 'a', effect, ctx);
    // 2 houses * 25 + 1 hotel * 100 = 150
    expect(money(next, 'a')).toBe(850);
  });

  it('is a no-op with no buildings', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a', { money: 1000, ownedTiles: [1] })]);
    const next = applyCardEffect(state, 'a', { kind: 'payRepairs', perHouse: 25, perHotel: 100 }, ctx);
    expect(next).toBe(state);
  });
});

describe('applyCardEffect — unknown player', () => {
  it('returns state unchanged', () => {
    const ctx = makeCtx();
    const state = withPlayers([player('a')]);
    expect(applyCardEffect(state, 'ghost', { kind: 'collectBank', amount: 50 }, ctx)).toBe(state);
  });
});
