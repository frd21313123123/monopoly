import type { GameState, Player } from './types.js';

export const STARTING_MONEY = 1500;
export const GO_BONUS = 200;

export function initialState(seed: number = Date.now() >>> 0): GameState {
  return {
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    turn: 0,
    rngState: seed >>> 0,
    lastRoll: null,
    rollSeq: 0,
    doublesThisTurn: 0,
    pendingEndTurn: false,
    pendingPurchase: null,
    pendingOffer: null,
    pendingAuction: null,
    pendingTrade: null,
    pendingDebt: null,
    buildings: {},
    mortgaged: [],
    chanceDeck: [],
    chestDeck: [],
    log: [],
    logSeq: 0,
  };
}

export function createPlayer(
  id: string,
  name: string,
  tokenId: string,
  color?: string,
): Player {
  return {
    id,
    name,
    tokenId,
    ...(color ? { color } : {}),
    position: 0,
    money: STARTING_MONEY,
    inJail: false,
    jailTurns: 0,
    ownedTiles: [],
    jailFreeCards: 0,
    bankrupt: false,
  };
}
