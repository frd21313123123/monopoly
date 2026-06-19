import { describe, expect, it } from 'vitest';
import {
  BOARD,
  BOARD_SIZE,
  JAIL_INDEX,
  STATION_INDICES,
  UTILITY_INDICES,
  getTile,
  tilesInGroup,
} from './board.js';
import { ColorGroup, TileKind } from './types.js';

describe('BOARD structure', () => {
  it('has exactly 40 tiles', () => {
    expect(BOARD).toHaveLength(40);
    expect(BOARD_SIZE).toBe(40);
  });

  it('every tile index equals its position in the array', () => {
    BOARD.forEach((tile, i) => {
      expect(tile.index).toBe(i);
    });
  });

  it('every tile has a nameKey', () => {
    for (const tile of BOARD) {
      expect(tile.nameKey).toBeTruthy();
    }
  });

  it('places the four corners correctly', () => {
    expect(BOARD[0]!.kind).toBe(TileKind.GO);
    expect(BOARD[10]!.kind).toBe(TileKind.JAIL);
    expect(BOARD[20]!.kind).toBe(TileKind.FREE_PARKING);
    expect(BOARD[30]!.kind).toBe(TileKind.GO_TO_JAIL);
  });

  it('has 22 streets, 4 stations, 2 utilities', () => {
    const streets = BOARD.filter((t) => t.kind === TileKind.STREET);
    const stations = BOARD.filter((t) => t.kind === TileKind.STATION);
    const utilities = BOARD.filter((t) => t.kind === TileKind.UTILITY);
    expect(streets).toHaveLength(22);
    expect(stations).toHaveLength(4);
    expect(utilities).toHaveLength(2);
  });

  it('every street has a price and an ascending rent ladder', () => {
    for (const tile of BOARD) {
      if (tile.kind !== TileKind.STREET) continue;
      expect(tile.price).toBeGreaterThan(0);
      const { base, mono, h1, h2, h3, h4, hotel } = tile.rent;
      expect(mono).toBe(base * 2);
      expect(h1).toBeGreaterThan(mono);
      expect(h2).toBeGreaterThan(h1);
      expect(h3).toBeGreaterThan(h2);
      expect(h4).toBeGreaterThan(h3);
      expect(hotel).toBeGreaterThan(h4);
    }
  });

  it('every color group has 2 or 3 streets', () => {
    for (const group of Object.values(ColorGroup)) {
      const n = tilesInGroup(group).length;
      expect([2, 3]).toContain(n);
    }
  });
});

describe('getTile', () => {
  it('returns the tile at a normal index', () => {
    expect(getTile(0).kind).toBe(TileKind.GO);
    expect(getTile(39).index).toBe(39);
  });

  it('wraps positive indices past the board', () => {
    expect(getTile(40)).toBe(getTile(0));
    expect(getTile(41)).toBe(getTile(1));
    expect(getTile(83)).toBe(getTile(3));
  });

  it('wraps negative indices', () => {
    expect(getTile(-1)).toBe(getTile(39));
    expect(getTile(-40)).toBe(getTile(0));
    expect(getTile(-41)).toBe(getTile(39));
  });
});

describe('tilesInGroup', () => {
  it('returns the brown streets', () => {
    expect(tilesInGroup(ColorGroup.BROWN)).toEqual([1, 3]);
  });

  it('returns the dark-blue streets', () => {
    expect(tilesInGroup(ColorGroup.DARK_BLUE)).toEqual([37, 39]);
  });

  it('only returns streets that belong to the group', () => {
    for (const idx of tilesInGroup(ColorGroup.ORANGE)) {
      const tile = getTile(idx);
      expect(tile.kind).toBe(TileKind.STREET);
      if (tile.kind === TileKind.STREET) expect(tile.group).toBe(ColorGroup.ORANGE);
    }
  });
});

describe('station and utility indices', () => {
  it('lists the four stations', () => {
    expect([...STATION_INDICES]).toEqual([5, 15, 25, 35]);
  });

  it('lists the two utilities', () => {
    expect([...UTILITY_INDICES]).toEqual([12, 28]);
  });

  it('JAIL_INDEX points at the jail tile', () => {
    expect(JAIL_INDEX).toBe(10);
    expect(getTile(JAIL_INDEX).kind).toBe(TileKind.JAIL);
  });
});
