import { BOARD_SIZE, getTile, JAIL_INDEX } from './board.js';
import {
  canBuyHouse,
  canSellHouse,
  clearPlayerBuildings,
  getBuildingLevel,
} from './buildings.js';
import { applyCardEffect, type CardEffectContext } from './card-effects.js';
import {
  CardDeck,
  CHANCE_CARDS,
  CHEST_CARDS,
  getChanceCard,
  getChestCard,
  shuffleDeck,
} from './cards.js';
import { createPlayer, GO_BONUS } from './initial.js';
import { computeRent, findOwner, isPurchasable, tilePrice } from './ownership.js';
import { rollDicePure } from './rng/dice.js';
import { MAX_PLAYERS, MIN_PLAYERS, TOKENS } from './tokens.js';
import {
  canMortgage,
  canUnmortgage,
  makeAuction,
  MIN_BID_INCREMENT,
  tradeBundleValid,
} from './trading.js';
import {
  HOTEL_LEVEL,
  JAIL_FINE,
  MAX_JAIL_TURNS,
  TileKind,
  type Action,
  type GameState,
  type LogEntry,
  type PendingAuction,
  type Player,
  type TileIndex,
  type TradeBundle,
} from './types.js';

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'lobby/addPlayer':
      return addPlayer(state, action.name, action.tokenId);
    case 'lobby/removePlayer':
      return removePlayer(state, action.playerId);
    case 'lobby/startGame':
      return startGame(state);
    case 'turn/rollAndMove':
      return rollAndMove(state);
    case 'turn/buyCurrent':
      return buyCurrent(state);
    case 'turn/declinePurchase':
      return declinePurchase(state);
    case 'turn/auctionCurrent':
      return auctionCurrent(state);
    case 'turn/offerPurchase':
      return offerPurchase(state, action.toPlayerId, action.price);
    case 'offer/accept':
      return offerAccept(state);
    case 'offer/decline':
      return offerDecline(state);
    case 'turn/end':
      return endTurn(state);
    case 'manage/buyHouse':
      return buyHouse(state, action.tileIndex);
    case 'manage/sellHouse':
      return sellHouse(state, action.tileIndex);
    case 'jail/roll':
      return jailRoll(state);
    case 'jail/payFine':
      return jailPayFine(state);
    case 'jail/useCard':
      return jailUseCard(state);
    case 'debt/pay':
      return payDebt(state);
    case 'debt/declareBankruptcy':
      return debtDeclareBankruptcy(state);
    case 'manage/mortgage':
      return mortgageTile(state, action.tileIndex);
    case 'manage/unmortgage':
      return unmortgageTile(state, action.tileIndex);
    case 'auction/bid':
      return auctionBid(state, action.playerId, action.amount);
    case 'auction/pass':
      return auctionPass(state, action.playerId);
    case 'trade/propose':
      return tradePropose(state, action.fromPlayerId, action.toPlayerId, action.fromOffer, action.toOffer);
    case 'trade/accept':
      return tradeAccept(state);
    case 'trade/decline':
      return tradeDecline(state);
  }
}

function mortgageTile(state: GameState, tileIndex: TileIndex): GameState {
  if (state.phase !== 'playing') return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt) return state;
  const check = canMortgage(state, current, tileIndex);
  if (!check.ok) return state;
  const updated: Player = { ...current, money: current.money + check.refund };
  const tile = getTile(tileIndex);
  return appendLogEntries(
    {
      ...state,
      players: replaceAt(state.players, state.currentPlayerIndex, updated),
      mortgaged: [...state.mortgaged, tileIndex],
    },
    [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.mortgaged',
        params: { name: current.name, tile: tile.nameKey, refund: check.refund },
      },
    ],
  );
}

function unmortgageTile(state: GameState, tileIndex: TileIndex): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingDebt) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt) return state;
  const check = canUnmortgage(state, current, tileIndex);
  if (!check.ok) return state;
  const updated: Player = { ...current, money: current.money - check.cost };
  const tile = getTile(tileIndex);
  return appendLogEntries(
    {
      ...state,
      players: replaceAt(state.players, state.currentPlayerIndex, updated),
      mortgaged: state.mortgaged.filter((i) => i !== tileIndex),
    },
    [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.unmortgaged',
        params: { name: current.name, tile: tile.nameKey, cost: check.cost },
      },
    ],
  );
}

function auctionBid(state: GameState, playerId: string, amount: number): GameState {
  if (!state.pendingAuction) return state;
  const auction = state.pendingAuction;
  if (auction.activePlayerIds[auction.turnIndex] !== playerId) return state;
  const minBid = auction.currentBid + MIN_BID_INCREMENT;
  if (amount < minBid) return state;
  const bidder = state.players.find((p) => p.id === playerId);
  if (!bidder || bidder.money < amount) return state;
  const newAuction: PendingAuction = {
    ...auction,
    currentBid: amount,
    highBidderId: playerId,
    turnIndex: advanceAuctionTurn(auction, auction.turnIndex, auction.activePlayerIds),
  };
  return maybeFinishAuction(
    appendLogEntries({ ...state, pendingAuction: newAuction }, [
      {
        turn: state.turn,
        playerId,
        messageKey: 'log.auctionBid',
        params: { name: bidder.name, amount },
      },
    ]),
  );
}

function auctionPass(state: GameState, playerId: string): GameState {
  if (!state.pendingAuction) return state;
  const auction = state.pendingAuction;
  if (auction.activePlayerIds[auction.turnIndex] !== playerId) return state;
  const remaining = auction.activePlayerIds.filter((id) => id !== playerId);
  let newTurnIndex = auction.turnIndex;
  if (newTurnIndex >= remaining.length) newTurnIndex = 0;
  const passer = state.players.find((p) => p.id === playerId);
  const newAuction: PendingAuction = {
    ...auction,
    activePlayerIds: remaining,
    turnIndex: newTurnIndex,
  };
  return maybeFinishAuction(
    appendLogEntries({ ...state, pendingAuction: newAuction }, [
      {
        turn: state.turn,
        playerId,
        messageKey: 'log.auctionPass',
        params: { name: passer?.name ?? playerId },
      },
    ]),
  );
}

function maybeFinishAuction(state: GameState): GameState {
  const auction = state.pendingAuction;
  if (!auction) return state;
  // Auction ends when only the highest bidder remains (or all pass with no bid).
  if (auction.activePlayerIds.length === 0) {
    return appendLogEntries({ ...state, pendingAuction: null, pendingEndTurn: true }, [
      {
        turn: state.turn,
        playerId: null,
        messageKey: 'log.auctionNoWinner',
        params: { tile: getTile(auction.tileIndex).nameKey },
      },
    ]);
  }
  if (auction.activePlayerIds.length === 1 && auction.highBidderId) {
    const winnerId = auction.highBidderId;
    if (auction.activePlayerIds[0] === winnerId) {
      const winnerIdx = state.players.findIndex((p) => p.id === winnerId);
      const winner = state.players[winnerIdx];
      if (!winner) return state;
      const tile = getTile(auction.tileIndex);
      const updated: Player = {
        ...winner,
        money: winner.money - auction.currentBid,
        ownedTiles: [...winner.ownedTiles, auction.tileIndex],
      };
      let next: GameState = {
        ...state,
        players: replaceAt(state.players, winnerIdx, updated),
        pendingAuction: null,
        pendingEndTurn: true,
      };
      next = appendLogEntries(next, [
        {
          turn: state.turn,
          playerId: winnerId,
          messageKey: 'log.auctionWon',
          params: { name: winner.name, tile: tile.nameKey, amount: auction.currentBid },
        },
      ]);
      return next;
    }
  }
  return state;
}

function advanceAuctionTurn(
  auction: PendingAuction,
  fromIndex: number,
  active: readonly string[],
): number {
  if (active.length === 0) return 0;
  return (fromIndex + 1) % active.length;
}

function tradePropose(
  state: GameState,
  fromId: string,
  toId: string,
  fromOffer: TradeBundle,
  toOffer: TradeBundle,
): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingTrade) return state;
  if (state.pendingDebt) return state;
  if (fromId === toId) return state;
  const from = state.players.find((p) => p.id === fromId);
  const to = state.players.find((p) => p.id === toId);
  if (!from || !to || from.bankrupt || to.bankrupt) return state;
  const fromValid = tradeBundleValid(state, from, fromOffer);
  if (!fromValid.ok) return state;
  const toValid = tradeBundleValid(state, to, toOffer);
  if (!toValid.ok) return state;
  return appendLogEntries(
    {
      ...state,
      pendingTrade: { fromPlayerId: fromId, toPlayerId: toId, fromOffer, toOffer },
    },
    [
      {
        turn: state.turn,
        playerId: fromId,
        messageKey: 'log.tradeProposed',
        params: { from: from.name, to: to.name },
      },
    ],
  );
}

function tradeAccept(state: GameState): GameState {
  const trade = state.pendingTrade;
  if (!trade) return state;
  const fromIdx = state.players.findIndex((p) => p.id === trade.fromPlayerId);
  const toIdx = state.players.findIndex((p) => p.id === trade.toPlayerId);
  const from = state.players[fromIdx];
  const to = state.players[toIdx];
  if (!from || !to) return state;
  // Re-validate to handle state changes between propose and accept.
  if (!tradeBundleValid(state, from, trade.fromOffer).ok) return state;
  if (!tradeBundleValid(state, to, trade.toOffer).ok) return state;

  const newFrom: Player = {
    ...from,
    money: from.money - trade.fromOffer.money + trade.toOffer.money,
    jailFreeCards: from.jailFreeCards - trade.fromOffer.jailFreeCards + trade.toOffer.jailFreeCards,
    ownedTiles: [
      ...from.ownedTiles.filter((t) => !trade.fromOffer.tiles.includes(t)),
      ...trade.toOffer.tiles,
    ],
  };
  const newTo: Player = {
    ...to,
    money: to.money - trade.toOffer.money + trade.fromOffer.money,
    jailFreeCards: to.jailFreeCards - trade.toOffer.jailFreeCards + trade.fromOffer.jailFreeCards,
    ownedTiles: [
      ...to.ownedTiles.filter((t) => !trade.toOffer.tiles.includes(t)),
      ...trade.fromOffer.tiles,
    ],
  };
  let players = replaceAt(state.players, fromIdx, newFrom);
  players = replaceAt(players, toIdx, newTo);
  return appendLogEntries({ ...state, players, pendingTrade: null }, [
    {
      turn: state.turn,
      playerId: trade.toPlayerId,
      messageKey: 'log.tradeAccepted',
      params: { from: from.name, to: to.name },
    },
  ]);
}

function tradeDecline(state: GameState): GameState {
  const trade = state.pendingTrade;
  if (!trade) return state;
  const from = state.players.find((p) => p.id === trade.fromPlayerId);
  const to = state.players.find((p) => p.id === trade.toPlayerId);
  return appendLogEntries({ ...state, pendingTrade: null }, [
    {
      turn: state.turn,
      playerId: trade.toPlayerId,
      messageKey: 'log.tradeDeclined',
      params: { from: from?.name ?? trade.fromPlayerId, to: to?.name ?? trade.toPlayerId },
    },
  ]);
}

function buyHouse(state: GameState, tileIndex: TileIndex): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingDebt) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt) return state;
  const check = canBuyHouse(state, current, tileIndex);
  if (!check.ok) return state;
  const tile = getTile(tileIndex);
  const newLevel = getBuildingLevel(state, tileIndex) + 1;
  const updated: Player = { ...current, money: current.money - check.cost };
  let next: GameState = {
    ...state,
    players: replaceAt(state.players, state.currentPlayerIndex, updated),
    buildings: { ...state.buildings, [tileIndex]: newLevel },
  };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: newLevel === HOTEL_LEVEL ? 'log.builtHotel' : 'log.builtHouse',
      params: { name: current.name, tile: tile.nameKey, level: newLevel, cost: check.cost },
    },
  ]);
  return next;
}

function jailRoll(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingEndTurn || state.pendingPurchase || state.pendingDebt) return state;
  const idx = state.currentPlayerIndex;
  const current = state.players[idx];
  if (!current || current.bankrupt || !current.inJail) return state;

  const { roll, nextRngState } = rollDicePure(state.rngState);
  let next: GameState = { ...state, rngState: nextRngState, lastRoll: roll, rollSeq: state.rollSeq + 1 };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.jailRoll',
      params: { name: current.name, a: roll.a, b: roll.b, sum: roll.sum },
    },
  ]);

  if (roll.isDouble) {
    const freed: Player = { ...current, inJail: false, jailTurns: 0 };
    next = { ...next, players: replaceAt(next.players, idx, freed) };
    next = appendLogEntries(next, [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.jailEscape',
        params: { name: current.name },
      },
    ]);
    return moveAfterJail(next, current.id, roll.sum);
  }

  const newJailTurns = current.jailTurns + 1;
  const updated: Player = { ...current, jailTurns: newJailTurns };
  next = { ...next, players: replaceAt(next.players, idx, updated) };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.jailRollFailed',
      params: { name: current.name, attempts: newJailTurns, max: MAX_JAIL_TURNS },
    },
  ]);

  if (newJailTurns >= MAX_JAIL_TURNS) {
    // Forced fine — must pay and move
    next = appendLogEntries(next, [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.jailForcedFine',
        params: { name: current.name, fine: JAIL_FINE },
      },
    ]);
    next = payOrBankrupt(next, current.id, null, JAIL_FINE);
    // Couldn't cover the fine: pause on the debt; leaving jail + the move happen
    // once the debt is settled (or the player declares bankruptcy).
    if (next.pendingDebt) {
      next = { ...next, pendingDebt: { ...next.pendingDebt, jailMoveSum: roll.sum } };
      return { ...next, doublesThisTurn: 0 };
    }
    const playerAfter = next.players[idx];
    if (playerAfter && !playerAfter.bankrupt) {
      const freed: Player = { ...playerAfter, inJail: false, jailTurns: 0 };
      next = { ...next, players: replaceAt(next.players, idx, freed) };
      return moveAfterJail(next, current.id, roll.sum);
    }
    return { ...next, pendingEndTurn: true, doublesThisTurn: 0 };
  }

  return { ...next, pendingEndTurn: true, doublesThisTurn: 0 };
}

function jailPayFine(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingEndTurn || state.pendingPurchase || state.pendingDebt) return state;
  const idx = state.currentPlayerIndex;
  const current = state.players[idx];
  if (!current || current.bankrupt || !current.inJail) return state;
  if (current.money < JAIL_FINE) return state;

  const freed: Player = {
    ...current,
    money: current.money - JAIL_FINE,
    inJail: false,
    jailTurns: 0,
  };
  let next: GameState = { ...state, players: replaceAt(state.players, idx, freed) };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.jailPaid',
      params: { name: current.name, fine: JAIL_FINE },
    },
  ]);
  return next;
}

function jailUseCard(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingEndTurn || state.pendingPurchase || state.pendingDebt) return state;
  const idx = state.currentPlayerIndex;
  const current = state.players[idx];
  if (!current || current.bankrupt || !current.inJail) return state;
  if (current.jailFreeCards <= 0) return state;

  const freed: Player = {
    ...current,
    jailFreeCards: current.jailFreeCards - 1,
    inJail: false,
    jailTurns: 0,
  };
  let next: GameState = { ...state, players: replaceAt(state.players, idx, freed) };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.jailUsedCard',
      params: { name: current.name },
    },
  ]);
  return next;
}

function payDebt(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const debt = state.pendingDebt;
  if (!debt) return state;
  const idx = state.players.findIndex((p) => p.id === debt.debtorId);
  const debtor = state.players[idx];
  if (!debtor || debtor.bankrupt) return state;
  if (debtor.money < debt.amount) return state;

  // Pay the creditor (or the bank) and clear the debt.
  let players = replaceAt(state.players, idx, { ...debtor, money: debtor.money - debt.amount });
  if (debt.creditorId) {
    const creditorIdx = players.findIndex((p) => p.id === debt.creditorId);
    const creditor = players[creditorIdx];
    if (creditor) {
      players = replaceAt(players, creditorIdx, { ...creditor, money: creditor.money + debt.amount });
    }
  }
  let next: GameState = { ...state, players, pendingDebt: null };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: debt.debtorId,
      messageKey: 'log.debtPaid',
      params: {
        name: debtor.name,
        amount: debt.amount,
        creditor: debt.creditorId
          ? players.find((p) => p.id === debt.creditorId)?.name ?? '—'
          : 'банк',
      },
    },
  ]);

  // The forced jail fine: once paid, leave jail and complete the move.
  if (debt.jailMoveSum !== undefined) {
    const freedIdx = next.players.findIndex((p) => p.id === debt.debtorId);
    const freed = next.players[freedIdx];
    if (freed) {
      next = {
        ...next,
        players: replaceAt(next.players, freedIdx, { ...freed, inJail: false, jailTurns: 0 }),
      };
      next = moveAfterJail(next, debt.debtorId, debt.jailMoveSum);
    }
  }
  return next;
}

function debtDeclareBankruptcy(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const debt = state.pendingDebt;
  if (!debt) return state;
  let next = declareBankruptcy(state, debt.debtorId, debt.creditorId, debt.amount);
  next = { ...next, pendingDebt: null };
  // If the game isn't over, advance past the now-bankrupt player.
  if (next.phase === 'playing') {
    next = endTurn({ ...next, pendingEndTurn: true });
  }
  return next;
}

function moveAfterJail(state: GameState, playerId: string, sum: number): GameState {
  const idx = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[idx];
  if (!player) return state;
  const oldPos = player.position;
  const newPos = (oldPos + sum) % BOARD_SIZE;
  const passedGo = newPos < oldPos;
  const moved: Player = {
    ...player,
    position: newPos,
    money: player.money + (passedGo ? GO_BONUS : 0),
  };
  let next: GameState = { ...state, players: replaceAt(state.players, idx, moved) };
  if (passedGo) {
    next = appendLogEntries(next, [
      { turn: next.turn, playerId, messageKey: 'log.passedGo', params: { name: player.name, bonus: GO_BONUS } },
    ]);
  }
  next = appendLogEntries(next, [
    { turn: next.turn, playerId, messageKey: 'log.movedTo', params: { name: player.name, position: newPos } },
  ]);
  next = processLanding(next, playerId, newPos, sum);
  return { ...next, pendingEndTurn: true, doublesThisTurn: 0 };
}

function sellHouse(state: GameState, tileIndex: TileIndex): GameState {
  if (state.phase !== 'playing') return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt) return state;
  const check = canSellHouse(state, current, tileIndex);
  if (!check.ok) return state;
  const tile = getTile(tileIndex);
  const newLevel = getBuildingLevel(state, tileIndex) - 1;
  const updated: Player = { ...current, money: current.money + check.refund };
  const buildings = { ...state.buildings };
  if (newLevel === 0) delete buildings[tileIndex];
  else buildings[tileIndex] = newLevel;
  let next: GameState = {
    ...state,
    players: replaceAt(state.players, state.currentPlayerIndex, updated),
    buildings,
  };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.soldHouse',
      params: { name: current.name, tile: tile.nameKey, level: newLevel, refund: check.refund },
    },
  ]);
  return next;
}

function addPlayer(state: GameState, name: string, tokenId: string): GameState {
  if (state.phase !== 'lobby') return state;
  if (state.players.length >= MAX_PLAYERS) return state;
  if (!TOKENS.some((t) => t.id === tokenId)) return state;
  if (state.players.some((p) => p.tokenId === tokenId)) return state;
  const trimmedName = name.trim();
  if (trimmedName.length === 0) return state;
  const id = nextPlayerId(state);
  const player = createPlayer(id, trimmedName, tokenId);
  return { ...state, players: [...state.players, player] };
}

function removePlayer(state: GameState, playerId: string): GameState {
  if (state.phase !== 'lobby') return state;
  return { ...state, players: state.players.filter((p) => p.id !== playerId) };
}

function startGame(state: GameState): GameState {
  if (state.phase !== 'lobby') return state;
  if (state.players.length < MIN_PLAYERS) return state;
  const chance = shuffleDeck(CHANCE_CARDS.length, state.rngState);
  const chest = shuffleDeck(CHEST_CARDS.length, chance.nextRngState);
  return {
    ...state,
    phase: 'playing',
    currentPlayerIndex: 0,
    turn: 1,
    rngState: chest.nextRngState,
    chanceDeck: chance.order,
    chestDeck: chest.order,
    log: appendLog(state.log, {
      turn: 1,
      playerId: null,
      messageKey: 'log.gameStarted',
      params: { count: state.players.length },
    }),
    logSeq: state.logSeq + 1,
  };
}

function rollAndMove(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (state.pendingEndTurn) return state;
  if (state.pendingPurchase) return state;
  if (state.pendingOffer) return state;
  if (state.pendingDebt) return state;

  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt || current.inJail) return state;

  const { roll, nextRngState } = rollDicePure(state.rngState);

  // Third consecutive double sends straight to jail (no move).
  if (roll.isDouble && state.doublesThisTurn + 1 === 3) {
    const jailed: Player = {
      ...current,
      position: JAIL_INDEX,
      inJail: true,
      jailTurns: 0,
    };
    const jailedState: GameState = {
      ...state,
      players: replaceAt(state.players, state.currentPlayerIndex, jailed),
      rngState: nextRngState,
      lastRoll: roll,
      rollSeq: state.rollSeq + 1,
      doublesThisTurn: 0,
      pendingEndTurn: true,
    };
    return appendLogEntries(jailedState, [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.thirdDoubleJail',
        params: { name: current.name },
      },
    ]);
  }

  const oldPos = current.position;
  const newPos = (oldPos + roll.sum) % BOARD_SIZE;
  const passedGo = newPos < oldPos;
  const newMoney = current.money + (passedGo ? GO_BONUS : 0);
  const movedPlayer: Player = { ...current, position: newPos, money: newMoney };

  let next: GameState = {
    ...state,
    players: replaceAt(state.players, state.currentPlayerIndex, movedPlayer),
    rngState: nextRngState,
    lastRoll: roll,
    rollSeq: state.rollSeq + 1,
    doublesThisTurn: roll.isDouble ? state.doublesThisTurn + 1 : 0,
    pendingEndTurn: false,
  };

  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.rolled',
      params: { a: roll.a, b: roll.b, sum: roll.sum, name: current.name },
    },
  ]);
  if (passedGo) {
    next = appendLogEntries(next, [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.passedGo',
        params: { name: current.name, bonus: GO_BONUS },
      },
    ]);
  }
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.movedTo',
      params: { name: current.name, position: newPos },
    },
  ]);

  next = processLanding(next, current.id, newPos, roll.sum);

  const playerAfter = next.players[state.currentPlayerIndex];
  const sentToJail = playerAfter?.inJail === true;
  const wentBankrupt = playerAfter?.bankrupt === true;
  const mustEndTurn = !roll.isDouble || sentToJail || wentBankrupt;

  if (roll.isDouble && !sentToJail && !wentBankrupt) {
    next = appendLogEntries(next, [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.doubleRoll',
        params: { name: current.name },
      },
    ]);
  }

  return { ...next, pendingEndTurn: mustEndTurn };
}

function processLanding(
  state: GameState,
  playerId: string,
  tileIndex: TileIndex,
  diceSum: number,
  rentMultiplier: number = 1,
  forceUtilityTenX: boolean = false,
): GameState {
  const tile = getTile(tileIndex);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  switch (tile.kind) {
    case TileKind.STREET:
    case TileKind.STATION:
    case TileKind.UTILITY: {
      const owner = findOwner(state, tileIndex);
      if (!owner) {
        if (isPurchasable(tileIndex) && player.money > 0) {
          return {
            ...state,
            pendingPurchase: { tileIndex, price: tilePrice(tileIndex) },
          };
        }
        return state;
      }
      if (owner.id === playerId) return state;
      const rent = computeRent(state, tileIndex, diceSum);
      if (!rent) return state;
      let amount = rent.amount * rentMultiplier;
      if (forceUtilityTenX && tile.kind === TileKind.UTILITY) {
        amount = diceSum * 10;
      }
      let next = appendLogEntries(state, [
        {
          turn: state.turn,
          playerId,
          messageKey: 'log.rentOwed',
          params: { name: player.name, owner: owner.name, amount, tile: tile.nameKey },
        },
      ]);
      next = payOrBankrupt(next, playerId, owner.id, amount);
      return next;
    }

    case TileKind.TAX: {
      let next = appendLogEntries(state, [
        {
          turn: state.turn,
          playerId,
          messageKey: 'log.taxOwed',
          params: { name: player.name, amount: tile.amount },
        },
      ]);
      next = payOrBankrupt(next, playerId, null, tile.amount);
      return next;
    }

    case TileKind.GO_TO_JAIL: {
      const updated: Player = {
        ...player,
        position: JAIL_INDEX,
        inJail: true,
        jailTurns: 0,
      };
      const idx = state.players.findIndex((p) => p.id === playerId);
      let next: GameState = {
        ...state,
        players: replaceAt(state.players, idx, updated),
        doublesThisTurn: 0,
      };
      next = appendLogEntries(next, [
        {
          turn: state.turn,
          playerId,
          messageKey: 'log.goToJail',
          params: { name: player.name },
        },
      ]);
      return next;
    }

    case TileKind.CHANCE:
      return drawCard(state, playerId, CardDeck.CHANCE, diceSum);
    case TileKind.CHEST:
      return drawCard(state, playerId, CardDeck.CHEST, diceSum);

    default:
      return state;
  }
}

function drawCard(
  state: GameState,
  playerId: string,
  deck: typeof CardDeck.CHANCE | typeof CardDeck.CHEST,
  diceSum: number,
): GameState {
  const deckArr = deck === CardDeck.CHANCE ? state.chanceDeck : state.chestDeck;
  if (deckArr.length === 0) return state;
  const topIdx = deckArr[0]!;
  const card = deck === CardDeck.CHANCE ? getChanceCard(topIdx) : getChestCard(topIdx);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  let next = appendLogEntries(state, [
    {
      turn: state.turn,
      playerId,
      messageKey: deck === CardDeck.CHANCE ? 'log.drewChance' : 'log.drewChest',
      params: { name: player.name, text: card.textKey },
    },
  ]);

  const ctx: CardEffectContext = {
    diceSum,
    landingHandler: processLanding,
    payHandler: payOrBankrupt,
    appendLog: appendLogEntries,
  };
  next = applyCardEffect(next, playerId, card.effect, ctx);

  const isJailFree = card.effect.kind === 'getOutOfJailFree';
  const remaining = deckArr.slice(1);
  const newDeck = isJailFree ? remaining : [...remaining, topIdx];
  return deck === CardDeck.CHANCE
    ? { ...next, chanceDeck: newDeck }
    : { ...next, chestDeck: newDeck };
}

function buyCurrent(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (!state.pendingPurchase) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt) return state;
  const { tileIndex, price } = state.pendingPurchase;
  if (current.money < price) return state;

  const updated: Player = {
    ...current,
    money: current.money - price,
    ownedTiles: [...current.ownedTiles, tileIndex],
  };
  const tile = getTile(tileIndex);
  let next: GameState = {
    ...state,
    players: replaceAt(state.players, state.currentPlayerIndex, updated),
    pendingPurchase: null,
  };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.bought',
      params: { name: current.name, tile: tile.nameKey, price },
    },
  ]);

  return next;
}

function declinePurchase(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (!state.pendingPurchase) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current) return state;
  const tileIndex = state.pendingPurchase.tileIndex;
  const tile = getTile(tileIndex);
  return appendLogEntries({ ...state, pendingPurchase: null }, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.declined',
      params: { name: current.name, tile: tile.nameKey },
    },
  ]);
}

function auctionCurrent(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (!state.pendingPurchase) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current) return state;
  const tileIndex = state.pendingPurchase.tileIndex;
  const tile = getTile(tileIndex);
  const activeCount = state.players.filter((p) => !p.bankrupt).length;
  let next: GameState = appendLogEntries({ ...state, pendingPurchase: null }, [
    {
      turn: state.turn,
      playerId: current.id,
      messageKey: 'log.declined',
      params: { name: current.name, tile: tile.nameKey },
    },
  ]);
  if (activeCount >= 2) {
    const auction = makeAuction(tileIndex, state.players);
    next = appendLogEntries({ ...next, pendingAuction: auction }, [
      {
        turn: state.turn,
        playerId: null,
        messageKey: 'log.auctionStarted',
        params: { tile: tile.nameKey },
      },
    ]);
  }
  return next;
}

function offerPurchase(state: GameState, toPlayerId: string, price: number): GameState {
  if (state.phase !== 'playing') return state;
  if (!state.pendingPurchase) return state;
  if (state.pendingOffer) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.bankrupt) return state;
  if (toPlayerId === current.id) return state;
  const to = state.players.find((p) => p.id === toPlayerId);
  if (!to || to.bankrupt) return state;
  if (!Number.isInteger(price) || price <= 0) return state;

  const { tileIndex, price: originalPrice } = state.pendingPurchase;
  const tile = getTile(tileIndex);
  return appendLogEntries(
    {
      ...state,
      pendingPurchase: null,
      pendingOffer: { tileIndex, fromPlayerId: current.id, toPlayerId, price, originalPrice },
    },
    [
      {
        turn: state.turn,
        playerId: current.id,
        messageKey: 'log.offerProposed',
        params: { from: current.name, to: to.name, tile: tile.nameKey, price },
      },
    ],
  );
}

function offerAccept(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const offer = state.pendingOffer;
  if (!offer) return state;
  const buyerIdx = state.players.findIndex((p) => p.id === offer.toPlayerId);
  const buyer = state.players[buyerIdx];
  if (!buyer || buyer.bankrupt) return state;
  if (buyer.money < offer.price) return state;
  const sellerIdx = state.players.findIndex((p) => p.id === offer.fromPlayerId);
  if (sellerIdx < 0) return state;

  // Buyer pays the named price to the offering (current) player and gets the tile.
  let players = replaceAt(state.players, buyerIdx, {
    ...buyer,
    money: buyer.money - offer.price,
    ownedTiles: [...buyer.ownedTiles, offer.tileIndex],
  });
  const seller = players[sellerIdx]!;
  players = replaceAt(players, sellerIdx, { ...seller, money: seller.money + offer.price });

  const tile = getTile(offer.tileIndex);
  return appendLogEntries({ ...state, players, pendingOffer: null }, [
    {
      turn: state.turn,
      playerId: offer.toPlayerId,
      messageKey: 'log.offerAccepted',
      params: { to: buyer.name, from: seller.name, tile: tile.nameKey, price: offer.price },
    },
  ]);
}

function offerDecline(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const offer = state.pendingOffer;
  if (!offer) return state;
  const to = state.players.find((p) => p.id === offer.toPlayerId);
  const tile = getTile(offer.tileIndex);
  // Hand the original purchase decision back to the current player.
  return appendLogEntries(
    {
      ...state,
      pendingOffer: null,
      pendingPurchase: { tileIndex: offer.tileIndex, price: offer.originalPrice },
    },
    [
      {
        turn: state.turn,
        playerId: offer.toPlayerId,
        messageKey: 'log.offerDeclined',
        params: { to: to?.name ?? offer.toPlayerId, tile: tile.nameKey },
      },
    ],
  );
}

function endTurn(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (!state.pendingEndTurn) return state;
  if (state.pendingPurchase) return state;
  if (state.pendingOffer) return state;
  if (state.pendingAuction) return state;
  if (state.pendingTrade) return state;
  if (state.pendingDebt) return state;

  const total = state.players.length;
  let nextIndex = (state.currentPlayerIndex + 1) % total;
  let safety = 0;
  while (state.players[nextIndex]?.bankrupt && safety < total) {
    nextIndex = (nextIndex + 1) % total;
    safety++;
  }
  const wrappedToStart = nextIndex <= state.currentPlayerIndex;
  const nextTurn = wrappedToStart ? state.turn + 1 : state.turn;
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    turn: nextTurn,
    lastRoll: null,
    doublesThisTurn: 0,
    pendingEndTurn: false,
  };
}

function payOrBankrupt(
  state: GameState,
  payerId: string,
  payeeId: string | null,
  amount: number,
): GameState {
  const payerIdx = state.players.findIndex((p) => p.id === payerId);
  const payer = state.players[payerIdx];
  if (!payer) return state;

  if (payer.money >= amount) {
    const updatedPayer: Player = { ...payer, money: payer.money - amount };
    let players = replaceAt(state.players, payerIdx, updatedPayer);
    if (payeeId) {
      const payeeIdx = players.findIndex((p) => p.id === payeeId);
      const payee = players[payeeIdx];
      if (payee) {
        players = replaceAt(players, payeeIdx, { ...payee, money: payee.money + amount });
      }
    }
    return { ...state, players };
  }

  // The current player can't cover it — pause and let them raise funds (sell /
  // mortgage) or declare bankruptcy from the debt modal. Non-current payers (e.g.
  // a "pay each player" card hitting someone else) still bankrupt immediately,
  // and a second simultaneous debt also falls back to instant bankruptcy.
  const isCurrentPlayer = state.players[state.currentPlayerIndex]?.id === payerId;
  if (isCurrentPlayer && !state.pendingDebt) {
    return {
      ...state,
      pendingDebt: { debtorId: payerId, creditorId: payeeId, amount },
    };
  }

  return declareBankruptcy(state, payerId, payeeId, amount);
}

function declareBankruptcy(
  state: GameState,
  payerId: string,
  creditorId: string | null,
  owed: number,
): GameState {
  const payerIdx = state.players.findIndex((p) => p.id === payerId);
  const payer = state.players[payerIdx];
  if (!payer) return state;

  const transferAmount = payer.money;
  const releasedTiles = payer.ownedTiles;
  const buildingsAfter = clearPlayerBuildings(state.buildings, releasedTiles);
  // Mortgaged tiles travel with the property; if going to the bank, they're cleared.
  const mortgagedAfter = creditorId
    ? state.mortgaged
    : state.mortgaged.filter((i) => !releasedTiles.includes(i));

  const bankruptPlayer: Player = {
    ...payer,
    money: 0,
    ownedTiles: [],
    bankrupt: true,
  };
  let players = replaceAt(state.players, payerIdx, bankruptPlayer);

  if (creditorId) {
    const creditorIdx = players.findIndex((p) => p.id === creditorId);
    const creditor = players[creditorIdx];
    if (creditor) {
      const updatedCreditor: Player = {
        ...creditor,
        money: creditor.money + transferAmount,
        ownedTiles: [...creditor.ownedTiles, ...releasedTiles],
      };
      players = replaceAt(players, creditorIdx, updatedCreditor);
    }
  }

  let next: GameState = { ...state, players, buildings: buildingsAfter, mortgaged: mortgagedAfter };
  next = appendLogEntries(next, [
    {
      turn: state.turn,
      playerId: payerId,
      messageKey: 'log.bankrupt',
      params: { name: payer.name, owed, creditor: creditorId ? players.find((p) => p.id === creditorId)?.name ?? '—' : 'банк' },
    },
  ]);

  const alive = players.filter((p) => !p.bankrupt);
  if (alive.length <= 1) {
    next = {
      ...next,
      phase: 'finished',
      pendingPurchase: null,
      pendingEndTurn: false,
    };
    if (alive[0]) {
      next = appendLogEntries(next, [
        {
          turn: state.turn,
          playerId: alive[0].id,
          messageKey: 'log.gameWon',
          params: { name: alive[0].name },
        },
      ]);
    }
  }
  return next;
}

function nextPlayerId(state: GameState): string {
  const max = state.players.reduce((m, p) => {
    const n = Number(p.id.replace('p', ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `p${max + 1}`;
}

function replaceAt<T>(arr: readonly T[], index: number, value: T): readonly T[] {
  return arr.map((v, i) => (i === index ? value : v));
}

function appendLog(log: readonly LogEntry[], ...entries: LogEntry[]): readonly LogEntry[] {
  const next = [...log, ...entries];
  return next.length > 100 ? next.slice(next.length - 100) : next;
}

function appendLogEntries(state: GameState, entries: readonly LogEntry[]): GameState {
  return { ...state, log: appendLog(state.log, ...entries), logSeq: state.logSeq + entries.length };
}
