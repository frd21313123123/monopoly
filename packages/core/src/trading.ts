import { getTile, tilesInGroup } from './board.js';
import { getBuildingLevel } from './buildings.js';
import {
  MORTGAGE_INTEREST,
  TileKind,
  type GameState,
  type PendingAuction,
  type Player,
  type TileIndex,
  type TradeBundle,
} from './types.js';

export function isMortgaged(state: GameState, tileIndex: TileIndex): boolean {
  return state.mortgaged.includes(tileIndex);
}

export function mortgageValue(tileIndex: TileIndex): number {
  const tile = getTile(tileIndex);
  if (tile.kind === TileKind.STREET || tile.kind === TileKind.STATION || tile.kind === TileKind.UTILITY) {
    return Math.floor(tile.price / 2);
  }
  return 0;
}

export function unmortgageCost(tileIndex: TileIndex): number {
  return Math.ceil(mortgageValue(tileIndex) * (1 + MORTGAGE_INTEREST));
}

export function canMortgage(
  state: GameState,
  player: Player,
  tileIndex: TileIndex,
): { ok: true; refund: number } | { ok: false; reason: string } {
  if (!player.ownedTiles.includes(tileIndex)) return { ok: false, reason: 'not owned' };
  if (isMortgaged(state, tileIndex)) return { ok: false, reason: 'already mortgaged' };
  const tile = getTile(tileIndex);
  if (
    tile.kind !== TileKind.STREET &&
    tile.kind !== TileKind.STATION &&
    tile.kind !== TileKind.UTILITY
  ) {
    return { ok: false, reason: 'not mortgageable' };
  }
  if (tile.kind === TileKind.STREET) {
    // Cannot mortgage if ANY tile in the group has buildings.
    const groupTiles = tilesInGroup(tile.group);
    for (const idx of groupTiles) {
      if (getBuildingLevel(state, idx) > 0) {
        return { ok: false, reason: 'has buildings in group' };
      }
    }
  }
  return { ok: true, refund: mortgageValue(tileIndex) };
}

export function canUnmortgage(
  state: GameState,
  player: Player,
  tileIndex: TileIndex,
): { ok: true; cost: number } | { ok: false; reason: string } {
  if (!player.ownedTiles.includes(tileIndex)) return { ok: false, reason: 'not owned' };
  if (!isMortgaged(state, tileIndex)) return { ok: false, reason: 'not mortgaged' };
  const cost = unmortgageCost(tileIndex);
  if (player.money < cost) return { ok: false, reason: 'insufficient funds' };
  return { ok: true, cost };
}

export function tradeBundleValid(
  state: GameState,
  player: Player,
  bundle: TradeBundle,
): { ok: true } | { ok: false; reason: string } {
  if (bundle.money < 0) return { ok: false, reason: 'negative money' };
  if (bundle.jailFreeCards < 0) return { ok: false, reason: 'negative cards' };
  if (player.money < bundle.money) return { ok: false, reason: 'insufficient money' };
  if (player.jailFreeCards < bundle.jailFreeCards) {
    return { ok: false, reason: 'insufficient jail cards' };
  }
  for (const tileIndex of bundle.tiles) {
    if (!player.ownedTiles.includes(tileIndex)) {
      return { ok: false, reason: `does not own tile ${tileIndex}` };
    }
    const tile = getTile(tileIndex);
    if (tile.kind === TileKind.STREET) {
      const groupTiles = tilesInGroup(tile.group);
      for (const idx of groupTiles) {
        if (getBuildingLevel(state, idx) > 0) {
          return { ok: false, reason: 'has buildings in group — sell first' };
        }
      }
    }
  }
  return { ok: true };
}

export function makeAuction(tileIndex: TileIndex, players: readonly Player[]): PendingAuction {
  const active = players.filter((p) => !p.bankrupt).map((p) => p.id);
  return {
    tileIndex,
    currentBid: 0,
    highBidderId: null,
    activePlayerIds: active,
    turnIndex: 0,
  };
}

export const MIN_BID_INCREMENT = 10;
