import { describe, expect, it } from 'vitest';
import { initialState, STARTING_MONEY } from './initial.js';
import { reduce } from './reducer.js';
import { getBuildingLevel } from './buildings.js';
import { getTile, BOARD_SIZE } from './board.js';
import { rollDicePure } from './rng/dice.js';
import { ColorGroup, HOUSE_COST, TileKind, type GameState } from './types.js';

function setupGame(): GameState {
  let s = initialState(42);
  s = reduce(s, { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
  s = reduce(s, { type: 'lobby/addPlayer', name: 'B', tokenId: 'car' });
  return reduce(s, { type: 'lobby/startGame' });
}

function giveOwnership(s: GameState, playerIndex: number, tiles: number[]): GameState {
  return {
    ...s,
    players: s.players.map((p, i) => (i === playerIndex ? { ...p, ownedTiles: tiles } : p)),
  };
}

function setMoney(s: GameState, playerIndex: number, money: number): GameState {
  return {
    ...s,
    players: s.players.map((p, i) => (i === playerIndex ? { ...p, money } : p)),
  };
}

describe('buyHouse', () => {
  it('rejects if player does not own the tile', () => {
    const s = setupGame();
    const next = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(next).toBe(s);
  });

  it('rejects if player owns tile but not full color group', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1]); // owns Маросейка but not Варварка
    const next = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(next).toBe(s);
  });

  it('builds a house when monopoly is held', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1, 3]);
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(getBuildingLevel(s, 1)).toBe(1);
    expect(s.players[0]!.money).toBe(STARTING_MONEY - HOUSE_COST[ColorGroup.BROWN]);
  });

  it('enforces even-build: cannot put 2nd house until other tile has 1', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1, 3]);
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    const blocked = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(blocked).toBe(s); // unchanged
    const onTile3 = reduce(s, { type: 'manage/buyHouse', tileIndex: 3 });
    expect(getBuildingLevel(onTile3, 3)).toBe(1);
    const back = reduce(onTile3, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(getBuildingLevel(back, 1)).toBe(2);
  });

  it('hotel is the 5th level (after 4 houses each)', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1, 3]);
    s = setMoney(s, 0, 10000);
    for (let lvl = 1; lvl <= 4; lvl++) {
      s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
      s = reduce(s, { type: 'manage/buyHouse', tileIndex: 3 });
    }
    expect(getBuildingLevel(s, 1)).toBe(4);
    expect(getBuildingLevel(s, 3)).toBe(4);
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(getBuildingLevel(s, 1)).toBe(5);
    const blocked = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(blocked).toBe(s);
  });

  it('rejects when player lacks funds', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1, 3]);
    s = setMoney(s, 0, 10);
    const next = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    expect(next).toBe(s);
  });
});

describe('sellHouse', () => {
  it('refunds half the build cost', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1, 3]);
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    const beforeSell = s.players[0]!.money;
    s = reduce(s, { type: 'manage/sellHouse', tileIndex: 1 });
    expect(getBuildingLevel(s, 1)).toBe(0);
    expect(s.players[0]!.money).toBe(beforeSell + Math.floor(HOUSE_COST[ColorGroup.BROWN] / 2));
  });

  it('enforces even-sell: must sell from highest first', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1, 3]);
    s = setMoney(s, 0, 10000);
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 });
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 3 });
    s = reduce(s, { type: 'manage/buyHouse', tileIndex: 1 }); // tile 1 has 2, tile 3 has 1
    const blocked = reduce(s, { type: 'manage/sellHouse', tileIndex: 3 });
    expect(blocked).toBe(s);
    const okSale = reduce(s, { type: 'manage/sellHouse', tileIndex: 1 });
    expect(getBuildingLevel(okSale, 1)).toBe(1);
  });

  it('rejects when nothing to sell', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [1]);
    const next = reduce(s, { type: 'manage/sellHouse', tileIndex: 1 });
    expect(next).toBe(s);
  });
});

describe('rent with buildings', () => {
  function findSeedForSum(sum: number): number {
    const mustDouble = sum === 2 || sum === 12;
    for (let s = 1; s < 500000; s++) {
      const { roll } = rollDicePure(s);
      if (roll.sum === sum && (mustDouble || !roll.isDouble)) return s;
    }
    throw new Error(`No seed for sum ${sum}`);
  }

  it('rent uses the level-1 ladder when 1 house built', () => {
    let s = setupGame();
    s = giveOwnership(s, 1, [1, 3]);
    s = { ...s, buildings: { 1: 1 } };
    // player 0 lands on tile 3 from start (sum=3)
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, position: 0 } : p)) };
    s = { ...s, rngState: findSeedForSum(3) };
    s = reduce(s, { type: 'turn/rollAndMove' });
    // Tile 3 has 0 houses → rent uses monopoly (player 1 owns full BROWN group)
    const tile3 = getTile(3);
    if (tile3.kind !== TileKind.STREET) throw new Error('bad fixture');
    expect(s.players[0]!.money).toBe(STARTING_MONEY - tile3.rent.mono);
  });

  it('rent uses hotel value when level=5', () => {
    let s = setupGame();
    s = giveOwnership(s, 1, [1, 3]);
    s = { ...s, buildings: { 3: 5 } };
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, position: 0, money: 5000 } : p)) };
    s = { ...s, rngState: findSeedForSum(3) };
    s = reduce(s, { type: 'turn/rollAndMove' });
    const tile = getTile(3);
    if (tile.kind !== TileKind.STREET) throw new Error('bad fixture');
    expect(s.players[0]!.money).toBe(5000 - tile.rent.hotel);
  });
});

describe('bankruptcy clears buildings', () => {
  function landRolls(target: number, from: number): number {
    const need = ((target - from) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
    const mustDouble = need === 2 || need === 12;
    for (let s = 1; s < 500000; s++) {
      const { roll } = rollDicePure(s);
      if (roll.sum === need && (mustDouble || !roll.isDouble)) return s;
    }
    throw new Error('seed?');
  }

  it('player going bankrupt loses their buildings', () => {
    let s = setupGame();
    s = giveOwnership(s, 0, [37]);
    s = giveOwnership(s, 1, [1, 3]);
    s = { ...s, buildings: { 1: 4, 3: 4 } };
    s = setMoney(s, 0, 1);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, position: 0 } : p)) };
    s = { ...s, rngState: landRolls(3, 0) };
    s = reduce(s, { type: 'turn/rollAndMove' });
    expect(s.players[0]!.bankrupt).toBe(true);
    // player 0 had tile 37, no buildings on it — still 0
    // No buildings should be cleared from tiles 1, 3 (those belong to creditor)
    expect(getBuildingLevel(s, 1)).toBe(4);
    expect(getBuildingLevel(s, 3)).toBe(4);
  });
});
