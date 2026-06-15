import { getTile, STATION_INDICES, tilesInGroup, UTILITY_INDICES } from './board.js';
import { HOTEL_LEVEL, TileKind, type GameState, type Player, type RentLadder, type TileIndex } from './types.js';

export function findOwner(state: GameState, tileIndex: TileIndex): Player | null {
  return state.players.find((p) => !p.bankrupt && p.ownedTiles.includes(tileIndex)) ?? null;
}

export function ownsFullGroup(player: Player, tileIndex: TileIndex): boolean {
  const tile = getTile(tileIndex);
  if (tile.kind !== TileKind.STREET) return false;
  const groupTiles = tilesInGroup(tile.group);
  return groupTiles.every((i) => player.ownedTiles.includes(i));
}

export function countStationsOwned(player: Player): number {
  return STATION_INDICES.filter((i) => player.ownedTiles.includes(i)).length;
}

export function countUtilitiesOwned(player: Player): number {
  return UTILITY_INDICES.filter((i) => player.ownedTiles.includes(i)).length;
}

export function computeRent(
  state: GameState,
  tileIndex: TileIndex,
  diceSum: number,
): { owner: Player; amount: number } | null {
  const owner = findOwner(state, tileIndex);
  if (!owner) return null;
  if (state.mortgaged.includes(tileIndex)) return null;
  const tile = getTile(tileIndex);

  switch (tile.kind) {
    case TileKind.STREET: {
      const level = state.buildings[tileIndex] ?? 0;
      const amount = streetRent(tile.rent, level, ownsFullGroup(owner, tileIndex));
      return { owner, amount };
    }
    case TileKind.STATION: {
      const n = countStationsOwned(owner);
      const amount = n > 0 ? 25 * 2 ** (n - 1) : 0;
      return { owner, amount };
    }
    case TileKind.UTILITY: {
      const n = countUtilitiesOwned(owner);
      const multiplier = n >= 2 ? 10 : 4;
      return { owner, amount: diceSum * multiplier };
    }
    default:
      return null;
  }
}

function streetRent(rent: RentLadder, level: number, hasMonopoly: boolean): number {
  switch (level) {
    case 0:
      return hasMonopoly ? rent.mono : rent.base;
    case 1:
      return rent.h1;
    case 2:
      return rent.h2;
    case 3:
      return rent.h3;
    case 4:
      return rent.h4;
    case HOTEL_LEVEL:
      return rent.hotel;
    default:
      return rent.base;
  }
}

export function isPurchasable(tileIndex: TileIndex): boolean {
  const tile = getTile(tileIndex);
  return (
    tile.kind === TileKind.STREET ||
    tile.kind === TileKind.STATION ||
    tile.kind === TileKind.UTILITY
  );
}

export function tilePrice(tileIndex: TileIndex): number {
  const tile = getTile(tileIndex);
  if (tile.kind === TileKind.STREET || tile.kind === TileKind.STATION || tile.kind === TileKind.UTILITY) {
    return tile.price;
  }
  return 0;
}
