import { describe, expect, it } from 'vitest';
import { initialState, STARTING_MONEY, GO_BONUS } from './initial.js';
import { reduce } from './reducer.js';
import { rollDicePure } from './rng/dice.js';
import { BOARD_SIZE, getTile } from './board.js';
import { findOwner } from './ownership.js';
import { t } from './i18n/ru.js';
import { TileKind, type Action, type GameState } from './types.js';
import { TOKEN_COLORS } from './tokens.js';

const seed = 12345;

function lobbyWithTwo(): GameState {
  let st = initialState(seed);
  st = reduce(st, { type: 'lobby/addPlayer', name: 'Алиса', tokenId: 'hat' });
  st = reduce(st, { type: 'lobby/addPlayer', name: 'Боб', tokenId: 'car' });
  return st;
}

function startedGame(): GameState {
  return reduce(lobbyWithTwo(), { type: 'lobby/startGame' });
}

function settlePending(s: GameState): GameState {
  let next = s;
  if (next.pendingPurchase) next = reduce(next, { type: 'turn/declinePurchase' });
  while (next.pendingAuction) {
    const turn = next.pendingAuction.turnIndex;
    const pid = next.pendingAuction.activePlayerIds[turn];
    if (!pid) break;
    next = reduce(next, { type: 'auction/pass', playerId: pid });
  }
  return next;
}

function patchPlayer(
  s: GameState,
  index: number,
  patch: Partial<GameState['players'][number]>,
): GameState {
  return { ...s, players: s.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) };
}

interface DoubleOption {
  allowDouble?: boolean;
}

function findSeedForSum(targetSum: number, opts: DoubleOption = {}): number {
  const mustDouble = targetSum === 2 || targetSum === 12;
  const allow = mustDouble || (opts.allowDouble ?? false);
  for (let s = 1; s < 500000; s++) {
    const { roll } = rollDicePure(s);
    if (roll.sum === targetSum && (allow || !roll.isDouble)) return s;
  }
  throw new Error(`No seed for sum ${targetSum}`);
}

function findDoubleSeed(): number {
  for (let s = 1; s < 100000; s++) {
    const { roll } = rollDicePure(s);
    if (roll.isDouble) return s;
  }
  throw new Error('No double found');
}

function findNonDoubleSeed(): number {
  for (let s = 1; s < 100000; s++) {
    const { roll } = rollDicePure(s);
    if (!roll.isDouble) return s;
  }
  throw new Error('No non-double found');
}

interface LandOpts {
  target: number;
  playerIndex: number;
  /** Force a specific sum (2..12). If omitted, picks smallest sum that avoids wrapping GO. */
  sum?: number;
}

function landAt(s: GameState, opts: LandOpts): GameState {
  const { target, playerIndex } = opts;
  // Skip sum 2 and 12 in auto-select since they're always doubles.
  const sumOptions = opts.sum ? [opts.sum] : [3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const sum of sumOptions) {
    const start = ((target - sum) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
    if (!opts.sum && start > target) continue;
    const seed = findSeedForSum(sum);
    const placed = patchPlayer(s, playerIndex, { position: start });
    return reduce({ ...placed, rngState: seed }, { type: 'turn/rollAndMove' });
  }
  throw new Error(`Cannot land on ${target}`);
}

function dispatch(s: GameState, ...actions: Action[]): GameState {
  return actions.reduce((acc, a) => reduce(acc, a), s);
}

describe('lobby', () => {
  it('adds a player with money and default position', () => {
    const s = reduce(initialState(seed), { type: 'lobby/addPlayer', name: 'Алиса', tokenId: 'hat' });
    expect(s.players).toHaveLength(1);
    const p = s.players[0]!;
    expect(p.name).toBe('Алиса');
    expect(p.tokenId).toBe('hat');
    expect(p.position).toBe(0);
    expect(p.money).toBe(STARTING_MONEY);
  });

  it('rejects duplicate token', () => {
    let s = reduce(initialState(seed), { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
    s = reduce(s, { type: 'lobby/addPlayer', name: 'B', tokenId: 'hat' });
    expect(s.players).toHaveLength(1);
  });

  it('rejects empty name', () => {
    const s = reduce(initialState(seed), { type: 'lobby/addPlayer', name: '   ', tokenId: 'hat' });
    expect(s.players).toHaveLength(0);
  });

  it('rejects unknown token', () => {
    const s = reduce(initialState(seed), { type: 'lobby/addPlayer', name: 'A', tokenId: 'nope' });
    expect(s.players).toHaveLength(0);
  });

  it('stores a chosen color from the palette', () => {
    const s = reduce(initialState(seed), {
      type: 'lobby/addPlayer',
      name: 'A',
      tokenId: 'hat',
      color: TOKEN_COLORS[0]!,
    });
    expect(s.players[0]!.color).toBe(TOKEN_COLORS[0]);
  });

  it('rejects a color outside the palette', () => {
    const s = reduce(initialState(seed), {
      type: 'lobby/addPlayer',
      name: 'A',
      tokenId: 'hat',
      color: '#123456',
    });
    expect(s.players).toHaveLength(0);
  });

  it('leaves color undefined when none is chosen', () => {
    const s = reduce(initialState(seed), { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
    expect(s.players[0]!.color).toBeUndefined();
  });

  it('caps at MAX_PLAYERS (8)', () => {
    let s = initialState(seed);
    const tokens = ['hat', 'car', 'dog', 'boot', 'ship', 'cat', 'rocket', 'unicorn'];
    tokens.forEach((id, i) => {
      s = reduce(s, { type: 'lobby/addPlayer', name: `P${i}`, tokenId: id });
    });
    s = reduce(s, { type: 'lobby/addPlayer', name: 'Overflow', tokenId: 'hat' });
    expect(s.players).toHaveLength(8);
  });

  it('removes a player by id', () => {
    let s = lobbyWithTwo();
    s = reduce(s, { type: 'lobby/removePlayer', playerId: 'p1' });
    expect(s.players).toHaveLength(1);
    expect(s.players[0]!.id).toBe('p2');
  });
});

describe('startGame', () => {
  it('fails with fewer than 2 players', () => {
    let s = reduce(initialState(seed), { type: 'lobby/addPlayer', name: 'Lone', tokenId: 'hat' });
    s = reduce(s, { type: 'lobby/startGame' });
    expect(s.phase).toBe('lobby');
  });

  it('transitions to playing with ≥2 players', () => {
    const s = startedGame();
    expect(s.phase).toBe('playing');
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.turn).toBe(1);
  });
});

describe('rollAndMove', () => {
  it('moves current player by dice sum', () => {
    const before = startedGame();
    const expected = rollDicePure(before.rngState);
    const after = reduce(before, { type: 'turn/rollAndMove' });
    expect(after.lastRoll).toEqual(expected.roll);
    expect(after.players[0]!.position).toBe(expected.roll.sum % BOARD_SIZE);
    expect(after.rngState).toBe(expected.nextRngState);
  });

  it('grants GO bonus when wrapping past start', () => {
    const s = startedGame();
    const lastTaxTile = patchPlayer(s, 0, { position: 38 });
    const seed5 = findSeedForSum(5);
    const after = reduce({ ...lastTaxTile, rngState: seed5 }, { type: 'turn/rollAndMove' });
    expect(after.players[0]!.position).toBe(3);
    expect(after.players[0]!.money).toBeGreaterThanOrEqual(STARTING_MONEY + GO_BONUS - 100);
  });

  it('does not set pendingEndTurn on a double', () => {
    let s = startedGame();
    s = { ...s, rngState: findDoubleSeed() };
    s = reduce(s, { type: 'turn/rollAndMove' });
    expect(s.lastRoll!.isDouble).toBe(true);
    expect(s.pendingEndTurn).toBe(false);
    expect(s.doublesThisTurn).toBe(1);
  });

  it('blocks second roll if pendingEndTurn (not double)', () => {
    let s = startedGame();
    s = { ...s, rngState: findNonDoubleSeed() };
    const first = reduce(s, { type: 'turn/rollAndMove' });
    expect(first.pendingEndTurn).toBe(true);
    const second = reduce(first, { type: 'turn/rollAndMove' });
    expect(second).toBe(first);
  });

  it('blocks roll if pendingPurchase', () => {
    const s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    expect(s.pendingPurchase).not.toBeNull();
    const blocked = reduce(s, { type: 'turn/rollAndMove' });
    expect(blocked).toBe(s);
  });
});

describe('endTurn', () => {
  it('advances to next player and resets', () => {
    let s = startedGame();
    s = { ...s, rngState: findNonDoubleSeed() };
    s = reduce(s, { type: 'turn/rollAndMove' });
    s = settlePending(s);
    const next = reduce(s, { type: 'turn/end' });
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.lastRoll).toBeNull();
    expect(next.doublesThisTurn).toBe(0);
    expect(next.pendingEndTurn).toBe(false);
  });

  it('blocks endTurn if pendingPurchase', () => {
    const s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    expect(s.pendingPurchase).not.toBeNull();
    const blocked = reduce(s, { type: 'turn/end' });
    expect(blocked).toBe(s);
  });

  it('blocks endTurn before rolling (no pendingEndTurn)', () => {
    const s = startedGame();
    const next = reduce(s, { type: 'turn/end' });
    expect(next).toBe(s);
  });

  it('skips bankrupt players in rotation', () => {
    let s = startedGame();
    s = patchPlayer(s, 1, { bankrupt: true });
    // Need 3 players so endTurn from 0 skips 1 and lands on 2
    s = reduce({ ...s, phase: 'lobby' }, { type: 'lobby/addPlayer', name: 'Cara', tokenId: 'dog' });
    s = reduce(s, { type: 'lobby/startGame' });
    s = patchPlayer(s, 1, { bankrupt: true });
    s = { ...s, rngState: findNonDoubleSeed() };
    s = reduce(s, { type: 'turn/rollAndMove' });
    s = settlePending(s);
    const next = reduce(s, { type: 'turn/end' });
    expect(next.currentPlayerIndex).toBe(2);
  });
});

describe('buy / decline', () => {
  it('buyCurrent deducts price and adds tile to ownership', () => {
    let s = landAt(startedGame(), { target: 1, playerIndex: 0, sum: 2 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const { tileIndex, price } = s.pendingPurchase;
    const moneyBefore = s.players[0]!.money;
    s = reduce(s, { type: 'turn/buyCurrent' });
    expect(s.pendingPurchase).toBeNull();
    expect(s.players[0]!.money).toBe(moneyBefore - price);
    expect(s.players[0]!.ownedTiles).toContain(tileIndex);
  });

  it('declinePurchase clears pendingPurchase without spending', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const moneyBefore = s.players[0]!.money;
    s = reduce(s, { type: 'turn/declinePurchase' });
    expect(s.pendingPurchase).toBeNull();
    expect(s.players[0]!.money).toBe(moneyBefore);
    expect(s.players[0]!.ownedTiles).toHaveLength(0);
  });

  it('buyCurrent rejected if insufficient funds', () => {
    let s = startedGame();
    s = patchPlayer(s, 0, { money: 50 });
    s = landAt(s, { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const before = s;
    s = reduce(s, { type: 'turn/buyCurrent' });
    expect(s).toBe(before);
  });
});

describe('log popups', () => {
  it('translates a card text key embedded in a log param', () => {
    // The {text} param is a card.* key and must be recursively translated.
    const rendered = t('log.drewChance', { name: 'Алиса', text: 'card.chance.buildingLoan' });
    expect(rendered).not.toContain('card.chance.buildingLoan');
    expect(rendered).toContain(t('card.chance.buildingLoan'));
  });

  it('logSeq keeps counting after the log array caps at 100 entries', () => {
    let s = startedGame();
    // Deep pockets so nobody bankrupts and the game runs long enough to cap the log.
    s = patchPlayer(patchPlayer(s, 0, { money: 1_000_000 }), 1, { money: 1_000_000 });
    for (let i = 0; i < 200 && s.phase === 'playing'; i++) {
      s = patchPlayer(patchPlayer(s, 0, { money: 1_000_000 }), 1, { money: 1_000_000 });
      const cur = s.players[s.currentPlayerIndex]!;
      s = cur.inJail
        ? reduce(s, { type: 'jail/payFine' })
        : settlePending(reduce(s, { type: 'turn/rollAndMove' }));
      if (s.pendingEndTurn) s = reduce(s, { type: 'turn/end' });
    }
    expect(s.log.length).toBeLessThanOrEqual(100);
    expect(s.logSeq).toBeGreaterThan(100);
  });
});

describe('rollSeq', () => {
  it('bumps on a real roll but not on a follow-up action', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    expect(s.rollSeq).toBe(1);
    if (!s.pendingPurchase) throw new Error('expected pending');
    const seqBeforeBuy = s.rollSeq;
    s = reduce(s, { type: 'turn/declinePurchase' });
    expect(s.rollSeq).toBe(seqBeforeBuy);
  });
});

describe('offer purchase to another player', () => {
  it('offerPurchase moves pendingPurchase into pendingOffer', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const tileIndex = s.pendingPurchase.tileIndex;
    const basePrice = s.pendingPurchase.price;
    const buyerId = s.players[1]!.id;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: 500 });
    expect(s.pendingPurchase).toBeNull();
    expect(s.pendingOffer).toEqual({
      tileIndex,
      fromPlayerId: s.players[0]!.id,
      toPlayerId: buyerId,
      price: 500,
      originalPrice: basePrice,
    });
  });

  it('accepting sends the base price to the bank and the markup to the offering player', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const tileIndex = s.pendingPurchase.tileIndex;
    const basePrice = s.pendingPurchase.price;
    const sellerMoney = s.players[0]!.money;
    const buyerMoney = s.players[1]!.money;
    const buyerId = s.players[1]!.id;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: 500 });
    s = reduce(s, { type: 'offer/accept' });
    expect(s.pendingOffer).toBeNull();
    // Buyer pays the full named price.
    expect(s.players[1]!.money).toBe(buyerMoney - 500);
    expect(s.players[1]!.ownedTiles).toContain(tileIndex);
    // Seller only pockets the markup over the tile's base (bank) price.
    expect(s.players[0]!.money).toBe(sellerMoney + (500 - basePrice));
    expect(s.players[0]!.ownedTiles).not.toContain(tileIndex);
  });

  it('accepting is rejected when the buyer cannot afford the price', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    s = patchPlayer(s, 1, { money: 100 });
    const buyerId = s.players[1]!.id;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: 500 });
    const before = s;
    s = reduce(s, { type: 'offer/accept' });
    expect(s).toBe(before);
    expect(s.pendingOffer).not.toBeNull();
  });

  it('declining restores the original purchase prompt for the current player', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const basePrice = s.pendingPurchase.price;
    const tileIndex = s.pendingPurchase.tileIndex;
    const buyerId = s.players[1]!.id;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: 500 });
    s = reduce(s, { type: 'offer/decline' });
    expect(s.pendingOffer).toBeNull();
    expect(s.pendingPurchase).toEqual({ tileIndex, price: basePrice });
  });

  it('offerPurchase rejects the current player as the target', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const before = s;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: s.players[0]!.id, price: 500 });
    expect(s).toBe(before);
  });

  it('offerPurchase rejects a price below the tile base price', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const basePrice = s.pendingPurchase.price;
    const buyerId = s.players[1]!.id;
    const before = s;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: basePrice - 10 });
    expect(s).toBe(before);
    expect(s.pendingOffer).toBeNull();
    expect(s.pendingPurchase).not.toBeNull();
  });

  it('offerPurchase allows a price equal to the tile base price (zero markup)', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const basePrice = s.pendingPurchase.price;
    const sellerMoney = s.players[0]!.money;
    const buyerId = s.players[1]!.id;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: basePrice });
    expect(s.pendingOffer).not.toBeNull();
    s = reduce(s, { type: 'offer/accept' });
    // Whole price goes to the bank; the offering player pockets nothing.
    expect(s.players[0]!.money).toBe(sellerMoney);
  });

  it('endTurn is blocked while an offer is pending', () => {
    let s = landAt(startedGame(), { target: 5, playerIndex: 0 });
    if (!s.pendingPurchase) throw new Error('expected pending');
    const buyerId = s.players[1]!.id;
    s = reduce(s, { type: 'turn/offerPurchase', toPlayerId: buyerId, price: 500 });
    const before = s;
    s = reduce(s, { type: 'turn/end' });
    expect(s).toBe(before);
  });
});

describe('rent', () => {
  it('opponent landing on owned street pays base rent', () => {
    let s = startedGame();
    s = patchPlayer(s, 1, { ownedTiles: [3] });
    s = landAt(s, { target: 3, playerIndex: 0, sum: 3 });
    const tile = getTile(3);
    if (tile.kind !== TileKind.STREET) throw new Error('bad fixture');
    expect(s.players[0]!.money).toBe(STARTING_MONEY - tile.rent.base);
    expect(s.players[1]!.money).toBe(STARTING_MONEY + tile.rent.base);
  });

  it('owner with full color group charges doubled rent', () => {
    let s = startedGame();
    s = patchPlayer(s, 1, { ownedTiles: [1, 3] });
    s = landAt(s, { target: 3, playerIndex: 0, sum: 3 });
    const tile = getTile(3);
    if (tile.kind !== TileKind.STREET) throw new Error('bad fixture');
    expect(s.players[0]!.money).toBe(STARTING_MONEY - tile.rent.mono);
  });

  it('station rent scales with stations owned (2 → ₽50)', () => {
    let s = startedGame();
    s = patchPlayer(s, 1, { ownedTiles: [5, 15] });
    s = landAt(s, { target: 5, playerIndex: 0, sum: 5 });
    expect(s.players[0]!.money).toBe(STARTING_MONEY - 50);
  });

  it('utility rent = dice * 4 with one utility', () => {
    let s = startedGame();
    s = patchPlayer(s, 1, { ownedTiles: [12] });
    s = landAt(s, { target: 12, playerIndex: 0, sum: 12 });
    const sum = s.lastRoll!.sum;
    expect(s.players[0]!.money).toBe(STARTING_MONEY - sum * 4);
  });

  it('landing on own property triggers no rent', () => {
    let s = startedGame();
    s = patchPlayer(s, 0, { ownedTiles: [3] });
    s = landAt(s, { target: 3, playerIndex: 0, sum: 3 });
    expect(s.players[0]!.money).toBe(STARTING_MONEY);
    expect(s.pendingPurchase).toBeNull();
  });
});

describe('tax', () => {
  it('landing on income tax deducts ₽200', () => {
    const s = landAt(startedGame(), { target: 4, playerIndex: 0, sum: 4 });
    expect(s.players[0]!.money).toBe(STARTING_MONEY - 200);
  });
});

describe('bankruptcy', () => {
  it('insufficient funds pauses on a debt instead of bankrupting instantly', () => {
    let s = startedGame();
    s = patchPlayer(s, 0, { money: 10 });
    s = landAt(s, { target: 4, playerIndex: 0, sum: 4 });
    expect(s.pendingDebt).not.toBeNull();
    expect(s.pendingDebt?.debtorId).toBe('p1');
    expect(s.players[0]!.bankrupt).toBe(false);
    expect(s.phase).toBe('playing');
  });

  it('declaring bankruptcy from a debt to the bank ends the game with 2 players', () => {
    let s = startedGame();
    s = patchPlayer(s, 0, { money: 10 });
    s = landAt(s, { target: 4, playerIndex: 0, sum: 4 });
    s = reduce(s, { type: 'debt/declareBankruptcy' });
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(s.players[0]!.money).toBe(0);
    expect(s.phase).toBe('finished');
  });

  it('declaring bankruptcy on rent transfers cash and tiles to creditor', () => {
    let s = startedGame();
    s = patchPlayer(s, 0, { money: 1, ownedTiles: [37] });
    s = patchPlayer(s, 1, { ownedTiles: [1, 3] });
    s = landAt(s, { target: 3, playerIndex: 0, sum: 3 });
    expect(s.pendingDebt?.creditorId).toBe('p2');
    s = reduce(s, { type: 'debt/declareBankruptcy' });
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(s.players[1]!.money).toBe(STARTING_MONEY + 1);
    expect(findOwner(s, 37)?.id).toBe('p2');
    expect(s.phase).toBe('finished');
  });

  it('paying off a debt after selling property clears it and continues the turn', () => {
    let s = startedGame();
    // p1 owes rent but can raise money by mortgaging an owned tile.
    s = patchPlayer(s, 0, { money: 1, ownedTiles: [37] });
    s = patchPlayer(s, 1, { ownedTiles: [1, 3] });
    s = landAt(s, { target: 3, playerIndex: 0, sum: 3 });
    expect(s.pendingDebt).not.toBeNull();
    const owed = s.pendingDebt!.amount;
    // Mortgage to raise cash (action allowed during debt).
    s = reduce(s, { type: 'manage/mortgage', tileIndex: 37 });
    expect(s.players[0]!.money).toBeGreaterThanOrEqual(owed);
    s = reduce(s, { type: 'debt/pay' });
    expect(s.pendingDebt).toBeNull();
    expect(s.players[0]!.bankrupt).toBe(false);
    expect(s.phase).toBe('playing');
  });
});

describe('go to jail', () => {
  it('landing on GO_TO_JAIL moves player to jail and ends turn', () => {
    const s = landAt(startedGame(), { target: 30, playerIndex: 0, sum: 10 });
    expect(s.players[0]!.position).toBe(10);
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.pendingEndTurn).toBe(true);
  });
});

describe('full turn flow', () => {
  it('hot-seat: 2 players buy and switch turns', () => {
    let s = startedGame();
    s = patchPlayer(s, 0, { position: 0 });
    s = landAt(s, { target: 5, playerIndex: 0 });
    expect(s.pendingPurchase).not.toBeNull();
    s = dispatch(s, { type: 'turn/buyCurrent' }, { type: 'turn/end' });
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.players[0]!.ownedTiles).toContain(5);
  });
});

void dispatch;
