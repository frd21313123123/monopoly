import { describe, expect, it } from 'vitest';
import { initialState, STARTING_MONEY } from './initial.js';
import { reduce } from './reducer.js';
import { rollDicePure } from './rng/dice.js';
import { JAIL_INDEX } from './board.js';
import { JAIL_FINE } from './types.js';
import type { GameState } from './types.js';

function setup(seed = 42): GameState {
  let s = initialState(seed);
  s = reduce(s, { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
  s = reduce(s, { type: 'lobby/addPlayer', name: 'B', tokenId: 'car' });
  return reduce(s, { type: 'lobby/startGame' });
}

function jailPlayer(s: GameState, index: number, jailTurns = 0): GameState {
  return {
    ...s,
    players: s.players.map((p, i) =>
      i === index ? { ...p, inJail: true, position: JAIL_INDEX, jailTurns } : p,
    ),
  };
}

function findDoubleSeed(): number {
  for (let s = 1; s < 100000; s++) {
    if (rollDicePure(s).roll.isDouble) return s;
  }
  throw new Error('No double seed');
}

function findNonDoubleSeed(): number {
  for (let s = 1; s < 100000; s++) {
    if (!rollDicePure(s).roll.isDouble) return s;
  }
  throw new Error('No non-double seed');
}

function findTripleDoubleSeed(): number {
  for (let s = 1; s < 10_000_000; s++) {
    const r1 = rollDicePure(s);
    if (!r1.roll.isDouble) continue;
    const r2 = rollDicePure(r1.nextRngState);
    if (!r2.roll.isDouble) continue;
    const r3 = rollDicePure(r2.nextRngState);
    if (!r3.roll.isDouble) continue;
    return s;
  }
  throw new Error('No triple-double seed');
}

describe('3 consecutive doubles', () => {
  it('third double sends player to jail without moving', () => {
    let s = setup();
    s = { ...s, rngState: findTripleDoubleSeed() };
    s = reduce(s, { type: 'turn/rollAndMove' }); // 1st double
    if (s.pendingPurchase) s = reduce(s, { type: 'turn/declinePurchase' });
    expect(s.doublesThisTurn).toBe(1);
    expect(s.players[0]!.inJail).toBe(false);
    s = reduce(s, { type: 'turn/rollAndMove' }); // 2nd double
    if (s.pendingPurchase) s = reduce(s, { type: 'turn/declinePurchase' });
    expect(s.doublesThisTurn).toBe(2);
    expect(s.players[0]!.inJail).toBe(false);
    s = reduce(s, { type: 'turn/rollAndMove' }); // 3rd double → jail
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.players[0]!.position).toBe(JAIL_INDEX);
    expect(s.pendingEndTurn).toBe(true);
    expect(s.doublesThisTurn).toBe(0);
  });
});

describe('rollAndMove blocked in jail', () => {
  it('returns state unchanged when current player is in jail', () => {
    const s = jailPlayer(setup(), 0);
    const next = reduce(s, { type: 'turn/rollAndMove' });
    expect(next).toBe(s);
  });
});

describe('jail/payFine', () => {
  it('pays ₽50 and frees the player', () => {
    const s = jailPlayer(setup(), 0);
    const next = reduce(s, { type: 'jail/payFine' });
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.money).toBe(STARTING_MONEY - JAIL_FINE);
    expect(next.players[0]!.position).toBe(JAIL_INDEX);
    // After fine, player can roll normally
    expect(next.pendingEndTurn).toBe(false);
  });

  it('blocks if player can\'t afford the fine', () => {
    let s = jailPlayer(setup(), 0);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 10 } : p)) };
    const next = reduce(s, { type: 'jail/payFine' });
    expect(next).toBe(s);
  });
});

describe('jail/useCard', () => {
  it('consumes a card and frees the player', () => {
    let s = jailPlayer(setup(), 0);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, jailFreeCards: 1 } : p)) };
    const next = reduce(s, { type: 'jail/useCard' });
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.jailFreeCards).toBe(0);
    expect(next.players[0]!.money).toBe(STARTING_MONEY);
  });

  it('blocks if no cards', () => {
    const s = jailPlayer(setup(), 0);
    const next = reduce(s, { type: 'jail/useCard' });
    expect(next).toBe(s);
  });
});

describe('jail/roll', () => {
  it('on doubles: player freed, moves by sum, no extra roll', () => {
    let s = jailPlayer(setup(), 0);
    s = { ...s, rngState: findDoubleSeed() };
    const next = reduce(s, { type: 'jail/roll' });
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.jailTurns).toBe(0);
    expect(next.players[0]!.position).not.toBe(JAIL_INDEX);
    expect(next.pendingEndTurn).toBe(true);
    expect(next.doublesThisTurn).toBe(0);
  });

  it('on non-double: stays in jail, jailTurns++, ends turn', () => {
    let s = jailPlayer(setup(), 0);
    s = { ...s, rngState: findNonDoubleSeed() };
    const next = reduce(s, { type: 'jail/roll' });
    expect(next.players[0]!.inJail).toBe(true);
    expect(next.players[0]!.jailTurns).toBe(1);
    expect(next.players[0]!.position).toBe(JAIL_INDEX);
    expect(next.pendingEndTurn).toBe(true);
  });

  it('3rd failed attempt: forced fine + move', () => {
    let s = jailPlayer(setup(), 0, 2); // already 2 failed
    s = { ...s, rngState: findNonDoubleSeed() };
    const moneyBefore = s.players[0]!.money;
    const next = reduce(s, { type: 'jail/roll' });
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.jailTurns).toBe(0);
    expect(next.players[0]!.money).toBeLessThanOrEqual(moneyBefore - JAIL_FINE);
    expect(next.players[0]!.position).not.toBe(JAIL_INDEX);
    expect(next.pendingEndTurn).toBe(true);
  });

  it('3rd failed attempt with insufficient funds → debt, then bankruptcy', () => {
    let s = jailPlayer(setup(), 0, 2);
    s = {
      ...s,
      rngState: findNonDoubleSeed(),
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 10 } : p)),
    };
    let next = reduce(s, { type: 'jail/roll' });
    expect(next.pendingDebt).not.toBeNull();
    expect(next.players[0]!.bankrupt).toBe(false);
    next = reduce(next, { type: 'debt/declareBankruptcy' });
    expect(next.players[0]!.bankrupt).toBe(true);
    expect(next.phase).toBe('finished');
  });
});
