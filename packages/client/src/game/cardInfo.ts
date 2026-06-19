import {
  countStationsOwned,
  countUtilitiesOwned,
  findOwner,
  getBuildingLevel,
  getTile,
  HOTEL_LEVEL,
  HOUSE_COST,
  isMortgaged,
  mortgageValue,
  ownsFullGroup,
  playerColor,
  t,
  TileKind,
  unmortgageCost,
  type GameState,
  type TileIndex,
} from '@monopoly/core';
import { GROUP_COLORS } from '../board/colors.js';

/** One row of the rent ladder; `active` marks the rent that applies right now. */
export interface RentRow {
  label: string;
  value: number;
  active: boolean;
}

export interface CardInfo {
  name: string;
  kind: TileKind;
  /** Color-group swatch for streets. */
  groupColor: string | null;
  /** Current owner, or null when the tile is unowned/unownable. */
  owner: { name: string; color: string } | null;
  /** True for a purchasable tile that nobody owns yet. */
  forSale: boolean;
  price: number | null;
  mortgaged: boolean;
  mortgageValue: number | null;
  unmortgageCost: number | null;
  houseCost: number | null;
  /** Rent ladder rows (streets/stations/utilities). Empty for special tiles. */
  rents: RentRow[];
  /** Short descriptive line for non-property tiles (tax, chance, etc.). */
  note: string | null;
}

/** Builds the full view-model shown in the hover tooltip for a tile. */
export function getCardInfo(state: GameState, tileIndex: TileIndex): CardInfo {
  const tile = getTile(tileIndex);
  const owner = findOwner(state, tileIndex);
  const mortgaged = isMortgaged(state, tileIndex);
  const ownerInfo = owner ? { name: owner.name, color: playerColor(owner) } : null;

  const base: CardInfo = {
    name: t(tile.nameKey),
    kind: tile.kind,
    groupColor: null,
    owner: ownerInfo,
    forSale: false,
    price: null,
    mortgaged,
    mortgageValue: null,
    unmortgageCost: null,
    houseCost: null,
    rents: [],
    note: null,
  };

  switch (tile.kind) {
    case TileKind.STREET: {
      const level = getBuildingLevel(state, tileIndex);
      const hasMono = owner ? ownsFullGroup(owner, tileIndex) : false;
      // A rent only "applies" when the tile is owned and unmortgaged.
      const live = !!owner && !mortgaged;
      const rents: RentRow[] = [
        { label: t('card.rentBase'), value: tile.rent.base, active: live && level === 0 && !hasMono },
        { label: t('card.rentMono'), value: tile.rent.mono, active: live && level === 0 && hasMono },
        { label: t('card.rentHouses', { n: 1 }), value: tile.rent.h1, active: live && level === 1 },
        { label: t('card.rentHouses', { n: 2 }), value: tile.rent.h2, active: live && level === 2 },
        { label: t('card.rentHouses', { n: 3 }), value: tile.rent.h3, active: live && level === 3 },
        { label: t('card.rentHouses', { n: 4 }), value: tile.rent.h4, active: live && level === 4 },
        { label: t('card.rentHotel'), value: tile.rent.hotel, active: live && level === HOTEL_LEVEL },
      ];
      return {
        ...base,
        groupColor: GROUP_COLORS[tile.group],
        forSale: !owner,
        price: tile.price,
        mortgageValue: mortgageValue(tileIndex),
        unmortgageCost: unmortgageCost(tileIndex),
        houseCost: HOUSE_COST[tile.group],
        rents,
      };
    }
    case TileKind.STATION: {
      const ownedCount = owner ? countStationsOwned(owner) : 0;
      const rents: RentRow[] = [1, 2, 3, 4].map((n) => ({
        label: t('card.stationCount', { n }),
        value: 25 * 2 ** (n - 1),
        active: !mortgaged && ownedCount === n,
      }));
      return {
        ...base,
        forSale: !owner,
        price: tile.price,
        mortgageValue: mortgageValue(tileIndex),
        unmortgageCost: unmortgageCost(tileIndex),
        rents,
      };
    }
    case TileKind.UTILITY: {
      const ownedCount = owner ? countUtilitiesOwned(owner) : 0;
      const rents: RentRow[] = [
        { label: t('card.utilityOne'), value: 4, active: !mortgaged && ownedCount === 1 },
        { label: t('card.utilityTwo'), value: 10, active: !mortgaged && ownedCount === 2 },
      ];
      return {
        ...base,
        forSale: !owner,
        price: tile.price,
        mortgageValue: mortgageValue(tileIndex),
        unmortgageCost: unmortgageCost(tileIndex),
        rents,
      };
    }
    case TileKind.TAX:
      return { ...base, note: t('card.taxNote', { amount: tile.amount }) };
    case TileKind.CHANCE:
      return { ...base, note: t('card.chanceNote') };
    case TileKind.CHEST:
      return { ...base, note: t('card.chestNote') };
    case TileKind.GO:
      return { ...base, note: t('card.goNote') };
    case TileKind.JAIL:
      return { ...base, note: t('card.jailNote') };
    case TileKind.GO_TO_JAIL:
      return { ...base, note: t('card.goToJailNote') };
    case TileKind.FREE_PARKING:
      return { ...base, note: t('card.freeParkingNote') };
    default:
      return base;
  }
}
