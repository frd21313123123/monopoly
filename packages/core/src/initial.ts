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
    doublesThisTurn: 0,
    pendingEndTurn: false,
    pendingPurchase: null,
    pendingAuction: null,
    pendingTrade: null,
    buildings: {},
    mortgaged: [],
    chanceDeck: [],
    chestDeck: [],
    log: [],
  };
}

export function createPlayer(id: string, name: string, tokenId: string): Player {
  return {
    id,
    name,
    tokenId,
    position: 0,
    money: STARTING_MONEY,
    inJail: false,
    jailTurns: 0,
    ownedTiles: [],
    jailFreeCards: 0,
    bankrupt: false,
  };
}
