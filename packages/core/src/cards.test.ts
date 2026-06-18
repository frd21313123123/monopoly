import { describe, expect, it } from 'vitest';
import { initialState, STARTING_MONEY } from './initial.js';
import { reduce } from './reducer.js';
import { rollDicePure } from './rng/dice.js';
import { BOARD_SIZE } from './board.js';
import { CHANCE_CARDS, CHEST_CARDS } from './cards.js';
import { JAIL_INDEX } from './board.js';
import type { CardEffect } from './cards.js';
import type { GameState } from './types.js';

function setup(): GameState {
  let s = initialState(7);
  s = reduce(s, { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
  s = reduce(s, { type: 'lobby/addPlayer', name: 'B', tokenId: 'car' });
  return reduce(s, { type: 'lobby/startGame' });
}

function chanceIdxByKind(kind: CardEffect['kind']): number {
  const i = CHANCE_CARDS.findIndex((c) => c.effect.kind === kind);
  if (i < 0) throw new Error(`No chance card with kind ${kind}`);
  return i;
}

function chestIdxByKind(kind: CardEffect['kind']): number {
  const i = CHEST_CARDS.findIndex((c) => c.effect.kind === kind);
  if (i < 0) throw new Error(`No chest card with kind ${kind}`);
  return i;
}

function chanceIdxByCardId(id: string): number {
  const i = CHANCE_CARDS.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`No chance card ${id}`);
  return i;
}

function setChanceTop(s: GameState, cardIndex: number): GameState {
  return { ...s, chanceDeck: [cardIndex, ...s.chanceDeck.filter((i) => i !== cardIndex)] };
}

function setChestTop(s: GameState, cardIndex: number): GameState {
  return { ...s, chestDeck: [cardIndex, ...s.chestDeck.filter((i) => i !== cardIndex)] };
}

function findSeedForSum(targetSum: number): number {
  const mustDouble = targetSum === 2 || targetSum === 12;
  for (let s = 1; s < 500000; s++) {
    const { roll } = rollDicePure(s);
    if (roll.sum === targetSum && (mustDouble || !roll.isDouble)) return s;
  }
  throw new Error(`No seed for sum ${targetSum}`);
}

function placePlayerAndRoll(s: GameState, target: number, playerIndex = 0): GameState {
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
  throw new Error(`Cannot land on ${target}`);
}

describe('deck setup', () => {
  it('startGame shuffles both decks into permutations', () => {
    const s = setup();
    expect(s.chanceDeck).toHaveLength(CHANCE_CARDS.length);
    expect(s.chestDeck).toHaveLength(CHEST_CARDS.length);
    expect([...s.chanceDeck].sort((a, b) => a - b)).toEqual(
      [...Array(CHANCE_CARDS.length).keys()],
    );
    expect([...s.chestDeck].sort((a, b) => a - b)).toEqual(
      [...Array(CHEST_CARDS.length).keys()],
    );
  });
});

describe('card draw mechanics', () => {
  it('non-jail-free card returns to bottom of deck after use', () => {
    const cardIdx = chanceIdxByKind('collectBank');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    const lengthBefore = s.chanceDeck.length;
    s = placePlayerAndRoll(s, 7); // CHANCE tile
    expect(s.chanceDeck).toHaveLength(lengthBefore);
    expect(s.chanceDeck[s.chanceDeck.length - 1]).toBe(cardIdx);
  });

  it('jail-free card is removed from deck and added to player.jailFreeCards', () => {
    const cardIdx = chanceIdxByKind('getOutOfJailFree');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    const lengthBefore = s.chanceDeck.length;
    s = placePlayerAndRoll(s, 7);
    expect(s.chanceDeck).toHaveLength(lengthBefore - 1);
    expect(s.chanceDeck).not.toContain(cardIdx);
    expect(s.players[0]!.jailFreeCards).toBe(1);
  });
});

describe('card effects', () => {
  it('moveTo with collectGo grants ₽200 when passing start', () => {
    // chance-1: advance to GO, collectGo: true
    const cardIdx = chanceIdxByCardId('chance-1');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    const before = s.players[0]!.money;
    s = placePlayerAndRoll(s, 7); // lands on CHANCE tile 7
    expect(s.players[0]!.position).toBe(0);
    expect(s.players[0]!.money).toBe(before + 200);
  });

  it('moveTo without collectGo does NOT give ₽200', () => {
    // chance-3: advance to Малая Бронная (39), collectGo:false
    const cardIdx = chanceIdxByCardId('chance-3');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.position).toBe(39);
    // Tile 39 is a STREET; landing triggers pendingPurchase. No GO bonus.
    expect(s.players[0]!.money).toBe(STARTING_MONEY);
  });

  it('moveRelative -3 from CHANCE 36 lands on CHEST 33 (chained draw)', () => {
    const goBackIdx = chanceIdxByCardId('chance-10');
    const chestBank200Idx = chestIdxByKind('collectBank');
    let s = setup();
    s = setChanceTop(s, goBackIdx);
    s = setChestTop(s, chestBank200Idx);
    const card = CHEST_CARDS[chestBank200Idx]!.effect as { kind: 'collectBank'; amount: number };
    const moneyBefore = s.players[0]!.money;
    s = placePlayerAndRoll(s, 36);
    expect(s.players[0]!.position).toBe(33);
    expect(s.players[0]!.money).toBe(moneyBefore + card.amount);
  });

  it('collectBank adds money', () => {
    const cardIdx = chanceIdxByCardId('chance-16'); // ₽150
    let s = setup();
    s = setChanceTop(s, cardIdx);
    const before = s.players[0]!.money;
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.money).toBe(before + 150);
  });

  it('payBank deducts money', () => {
    const cardIdx = chanceIdxByCardId('chance-13'); // ₽15 fine
    let s = setup();
    s = setChanceTop(s, cardIdx);
    const before = s.players[0]!.money;
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.money).toBe(before - 15);
  });

  it('payEach charges ₽50 to every other player', () => {
    const cardIdx = chanceIdxByCardId('chance-15');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.money).toBe(STARTING_MONEY - 50);
    expect(s.players[1]!.money).toBe(STARTING_MONEY + 50);
  });

  it('collectEach takes ₽10 from each other player (chest birthday)', () => {
    const cardIdx = chestIdxByKind('collectEach');
    let s = setup();
    s = setChestTop(s, cardIdx);
    s = placePlayerAndRoll(s, 17); // CHEST tile
    expect(s.players[0]!.money).toBe(STARTING_MONEY + 10);
    expect(s.players[1]!.money).toBe(STARTING_MONEY - 10);
  });

  it('goToJail sends player to jail and forces end of turn', () => {
    const cardIdx = chanceIdxByCardId('chance-11');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.position).toBe(JAIL_INDEX);
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.pendingEndTurn).toBe(true);
  });

  it('moveToNearestStation charges DOUBLE rent if owned', () => {
    const cardIdx = chanceIdxByCardId('chance-5');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    // Player B owns Курский (15) — nearest station ahead of CHANCE 7
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, ownedTiles: [15] } : p)) };
    const before = s.players[0]!.money;
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.position).toBe(15);
    // Normal rent for 1 station = ₽25, doubled = ₽50
    expect(s.players[0]!.money).toBe(before - 50);
  });

  it('moveToNearestUtility charges 10× dice if owned', () => {
    const cardIdx = chanceIdxByCardId('chance-7');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, ownedTiles: [12] } : p)) };
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.position).toBe(12);
    const sum = s.lastRoll!.sum;
    expect(s.players[0]!.money).toBe(STARTING_MONEY - sum * 10);
  });

  it('payRepairs costs ₽25 per house, ₽100 per hotel (chance variant)', () => {
    const cardIdx = chanceIdxByCardId('chance-12');
    let s = setup();
    s = setChanceTop(s, cardIdx);
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, ownedTiles: [1, 3] } : p)),
      buildings: { 1: 3, 3: 5 }, // 3 houses + 1 hotel
    };
    const before = s.players[0]!.money;
    s = placePlayerAndRoll(s, 7);
    expect(s.players[0]!.money).toBe(before - (3 * 25 + 100));
  });

  it('pauses on a debt when a card forces an unaffordable payment', () => {
    const cardIdx = chanceIdxByCardId('chance-13'); // payBank ₽15
    let s = setup();
    s = setChanceTop(s, cardIdx);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 5 } : p)) };
    s = placePlayerAndRoll(s, 7);
    expect(s.pendingDebt).not.toBeNull();
    expect(s.players[0]!.bankrupt).toBe(false);
  });
});

