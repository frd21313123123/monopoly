import { getTile, tilesInGroup } from './board.js';
import { ownsFullGroup } from './ownership.js';
import {
  HOTEL_LEVEL,
  HOUSE_COST,
  TileKind,
  type ColorGroup,
  type GameState,
  type Player,
  type TileIndex,
} from './types.js';

export function getBuildingLevel(state: GameState, tileIndex: TileIndex): number {
  return state.buildings[tileIndex] ?? 0;
}

export function groupLevels(state: GameState, group: ColorGroup): readonly number[] {
  return tilesInGroup(group).map((i) => getBuildingLevel(state, i));
}

export function groupMinLevel(state: GameState, group: ColorGroup): number {
  const levels = groupLevels(state, group);
  return levels.length === 0 ? 0 : Math.min(...levels);
}

export function groupMaxLevel(state: GameState, group: ColorGroup): number {
  const levels = groupLevels(state, group);
  return levels.length === 0 ? 0 : Math.max(...levels);
}

export function canBuyHouse(
  state: GameState,
  player: Player,
  tileIndex: TileIndex,
): { ok: true; cost: number } | { ok: false; reason: string } {
  const tile = getTile(tileIndex);
  if (tile.kind !== TileKind.STREET) return { ok: false, reason: 'not a street' };
  if (!player.ownedTiles.includes(tileIndex)) return { ok: false, reason: 'not owned' };
  if (!ownsFullGroup(player, tileIndex)) return { ok: false, reason: 'no monopoly' };
  const level = getBuildingLevel(state, tileIndex);
  if (level >= HOTEL_LEVEL) return { ok: false, reason: 'hotel already' };
  const minLevel = groupMinLevel(state, tile.group);
  if (level !== minLevel) return { ok: false, reason: 'must build evenly' };
  const cost = HOUSE_COST[tile.group];
  if (player.money < cost) return { ok: false, reason: 'insufficient funds' };
  return { ok: true, cost };
}

export function canSellHouse(
  state: GameState,
  player: Player,
  tileIndex: TileIndex,
): { ok: true; refund: number } | { ok: false; reason: string } {
  const tile = getTile(tileIndex);
  if (tile.kind !== TileKind.STREET) return { ok: false, reason: 'not a street' };
  if (!player.ownedTiles.includes(tileIndex)) return { ok: false, reason: 'not owned' };
  const level = getBuildingLevel(state, tileIndex);
  if (level <= 0) return { ok: false, reason: 'nothing to sell' };
  const maxLevel = groupMaxLevel(state, tile.group);
  if (level !== maxLevel) return { ok: false, reason: 'must sell evenly' };
  const refund = Math.floor(HOUSE_COST[tile.group] / 2);
  return { ok: true, refund };
}

export function clearPlayerBuildings(
  buildings: Readonly<Record<TileIndex, number>>,
  ownedTiles: readonly TileIndex[],
): Record<TileIndex, number> {
  const next = { ...buildings };
  for (const t of ownedTiles) delete next[t];
  return next;
}
