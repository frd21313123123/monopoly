import type { DiceRoll } from './rng/dice.js';

export const ColorGroup = {
  BROWN: 'BROWN',
  LIGHT_BLUE: 'LIGHT_BLUE',
  PINK: 'PINK',
  ORANGE: 'ORANGE',
  RED: 'RED',
  YELLOW: 'YELLOW',
  GREEN: 'GREEN',
  DARK_BLUE: 'DARK_BLUE',
} as const;
export type ColorGroup = (typeof ColorGroup)[keyof typeof ColorGroup];

export const TileKind = {
  GO: 'GO',
  STREET: 'STREET',
  STATION: 'STATION',
  UTILITY: 'UTILITY',
  CHANCE: 'CHANCE',
  CHEST: 'CHEST',
  TAX: 'TAX',
  JAIL: 'JAIL',
  FREE_PARKING: 'FREE_PARKING',
  GO_TO_JAIL: 'GO_TO_JAIL',
} as const;
export type TileKind = (typeof TileKind)[keyof typeof TileKind];

export type TileIndex = number;

export interface RentLadder {
  base: number;
  mono: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  hotel: number;
}

interface TileBase {
  index: TileIndex;
  nameKey: string;
}

export type Tile =
  | (TileBase & { kind: typeof TileKind.GO })
  | (TileBase & {
      kind: typeof TileKind.STREET;
      group: ColorGroup;
      price: number;
      rent: RentLadder;
    })
  | (TileBase & { kind: typeof TileKind.STATION; price: number })
  | (TileBase & { kind: typeof TileKind.UTILITY; price: number })
  | (TileBase & { kind: typeof TileKind.CHANCE })
  | (TileBase & { kind: typeof TileKind.CHEST })
  | (TileBase & { kind: typeof TileKind.TAX; amount: number })
  | (TileBase & { kind: typeof TileKind.JAIL })
  | (TileBase & { kind: typeof TileKind.FREE_PARKING })
  | (TileBase & { kind: typeof TileKind.GO_TO_JAIL });

export const HOUSE_COST: Record<ColorGroup, number> = {
  [ColorGroup.BROWN]: 50,
  [ColorGroup.LIGHT_BLUE]: 50,
  [ColorGroup.PINK]: 100,
  [ColorGroup.ORANGE]: 100,
  [ColorGroup.RED]: 150,
  [ColorGroup.YELLOW]: 150,
  [ColorGroup.GREEN]: 200,
  [ColorGroup.DARK_BLUE]: 200,
};

export interface Player {
  id: string;
  name: string;
  tokenId: string;
  position: TileIndex;
  money: number;
  inJail: boolean;
  jailTurns: number;
  ownedTiles: readonly TileIndex[];
  jailFreeCards: number;
  bankrupt: boolean;
}

export const Phase = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  FINISHED: 'finished',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export interface PendingPurchase {
  tileIndex: TileIndex;
  price: number;
}

export interface PendingAuction {
  tileIndex: TileIndex;
  currentBid: number;
  highBidderId: string | null;
  activePlayerIds: readonly string[];
  turnIndex: number;
}

export interface TradeBundle {
  tiles: readonly TileIndex[];
  money: number;
  jailFreeCards: number;
}

export interface PendingTrade {
  fromPlayerId: string;
  toPlayerId: string;
  fromOffer: TradeBundle;
  toOffer: TradeBundle;
}

export interface GameState {
  phase: Phase;
  players: readonly Player[];
  currentPlayerIndex: number;
  turn: number;
  rngState: number;
  lastRoll: DiceRoll | null;
  doublesThisTurn: number;
  pendingEndTurn: boolean;
  pendingPurchase: PendingPurchase | null;
  pendingAuction: PendingAuction | null;
  pendingTrade: PendingTrade | null;
  /** Building level per tile: 0 = none, 1-4 = houses, 5 = hotel. */
  buildings: Readonly<Record<TileIndex, number>>;
  /** Set of mortgaged tile indices. */
  mortgaged: readonly TileIndex[];
  /** Order of remaining chance card indices; top of deck is element 0. */
  chanceDeck: readonly number[];
  /** Order of remaining community chest card indices; top is element 0. */
  chestDeck: readonly number[];
  log: readonly LogEntry[];
}

export const HOTEL_LEVEL = 5;
export const MAX_HOUSES = 4;

export interface LogEntry {
  turn: number;
  playerId: string | null;
  messageKey: string;
  params?: Readonly<Record<string, string | number>>;
}

export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const MORTGAGE_INTEREST = 0.1;

export type Action =
  | { type: 'lobby/addPlayer'; name: string; tokenId: string }
  | { type: 'lobby/removePlayer'; playerId: string }
  | { type: 'lobby/startGame' }
  | { type: 'turn/rollAndMove' }
  | { type: 'turn/buyCurrent' }
  | { type: 'turn/declinePurchase' }
  | { type: 'turn/auctionCurrent' }
  | { type: 'turn/end' }
  | { type: 'manage/buyHouse'; tileIndex: TileIndex }
  | { type: 'manage/sellHouse'; tileIndex: TileIndex }
  | { type: 'manage/mortgage'; tileIndex: TileIndex }
  | { type: 'manage/unmortgage'; tileIndex: TileIndex }
  | { type: 'jail/roll' }
  | { type: 'jail/payFine' }
  | { type: 'jail/useCard' }
  | { type: 'auction/bid'; playerId: string; amount: number }
  | { type: 'auction/pass'; playerId: string }
  | {
      type: 'trade/propose';
      fromPlayerId: string;
      toPlayerId: string;
      fromOffer: TradeBundle;
      toOffer: TradeBundle;
    }
  | { type: 'trade/accept' }
  | { type: 'trade/decline' };
