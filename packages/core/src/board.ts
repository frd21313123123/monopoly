import { ColorGroup, TileKind, type RentLadder, type Tile, type TileIndex } from './types.js';

function rent(
  base: number,
  mono: number,
  h1: number,
  h2: number,
  h3: number,
  h4: number,
  hotel: number,
): RentLadder {
  return { base, mono, h1, h2, h3, h4, hotel };
}

export const BOARD: readonly Tile[] = [
  { index: 0, kind: TileKind.GO, nameKey: 'tile.go' },
  { index: 1, kind: TileKind.STREET, nameKey: 'tile.marosejka', group: ColorGroup.BROWN, price: 60, rent: rent(2, 4, 10, 30, 90, 160, 250) },
  { index: 2, kind: TileKind.CHEST, nameKey: 'tile.chest' },
  { index: 3, kind: TileKind.STREET, nameKey: 'tile.varvarka', group: ColorGroup.BROWN, price: 60, rent: rent(4, 8, 20, 60, 180, 320, 450) },
  { index: 4, kind: TileKind.TAX, nameKey: 'tile.incomeTax', amount: 200 },
  { index: 5, kind: TileKind.STATION, nameKey: 'tile.rizhskij', price: 200 },
  { index: 6, kind: TileKind.STREET, nameKey: 'tile.kievskaya', group: ColorGroup.LIGHT_BLUE, price: 100, rent: rent(6, 12, 30, 90, 270, 400, 550) },
  { index: 7, kind: TileKind.CHANCE, nameKey: 'tile.chance' },
  { index: 8, kind: TileKind.STREET, nameKey: 'tile.ogareva', group: ColorGroup.LIGHT_BLUE, price: 100, rent: rent(6, 12, 30, 90, 270, 400, 550) },
  { index: 9, kind: TileKind.STREET, nameKey: 'tile.yakimanka', group: ColorGroup.LIGHT_BLUE, price: 120, rent: rent(8, 16, 40, 100, 300, 450, 600) },
  { index: 10, kind: TileKind.JAIL, nameKey: 'tile.jail' },
  { index: 11, kind: TileKind.STREET, nameKey: 'tile.polyanka', group: ColorGroup.PINK, price: 140, rent: rent(10, 20, 50, 150, 450, 625, 750) },
  { index: 12, kind: TileKind.UTILITY, nameKey: 'tile.electric', price: 150 },
  { index: 13, kind: TileKind.STREET, nameKey: 'tile.sretenka', group: ColorGroup.PINK, price: 140, rent: rent(10, 20, 50, 150, 450, 625, 750) },
  { index: 14, kind: TileKind.STREET, nameKey: 'tile.neglinnaya', group: ColorGroup.PINK, price: 160, rent: rent(12, 24, 60, 180, 500, 700, 900) },
  { index: 15, kind: TileKind.STATION, nameKey: 'tile.kurskij', price: 200 },
  { index: 16, kind: TileKind.STREET, nameKey: 'tile.ordynka', group: ColorGroup.ORANGE, price: 180, rent: rent(14, 28, 70, 200, 550, 750, 950) },
  { index: 17, kind: TileKind.CHEST, nameKey: 'tile.chest' },
  { index: 18, kind: TileKind.STREET, nameKey: 'tile.pyatnickaya', group: ColorGroup.ORANGE, price: 180, rent: rent(14, 28, 70, 200, 550, 750, 950) },
  { index: 19, kind: TileKind.STREET, nameKey: 'tile.lubyanka', group: ColorGroup.ORANGE, price: 200, rent: rent(16, 32, 80, 220, 600, 800, 1000) },
  { index: 20, kind: TileKind.FREE_PARKING, nameKey: 'tile.freeParking' },
  { index: 21, kind: TileKind.STREET, nameKey: 'tile.zemlyanojVal', group: ColorGroup.RED, price: 220, rent: rent(18, 36, 90, 250, 700, 875, 1050) },
  { index: 22, kind: TileKind.CHANCE, nameKey: 'tile.chance' },
  { index: 23, kind: TileKind.STREET, nameKey: 'tile.kutuzovskij', group: ColorGroup.RED, price: 220, rent: rent(18, 36, 90, 250, 700, 875, 1050) },
  { index: 24, kind: TileKind.STREET, nameKey: 'tile.prospektMira', group: ColorGroup.RED, price: 240, rent: rent(20, 40, 100, 300, 750, 925, 1100) },
  { index: 25, kind: TileKind.STATION, nameKey: 'tile.severnyj', price: 200 },
  { index: 26, kind: TileKind.STREET, nameKey: 'tile.pushkinskaya', group: ColorGroup.YELLOW, price: 260, rent: rent(22, 44, 110, 330, 800, 975, 1150) },
  { index: 27, kind: TileKind.STREET, nameKey: 'tile.mayakovskaya', group: ColorGroup.YELLOW, price: 260, rent: rent(22, 44, 110, 330, 800, 975, 1150) },
  { index: 28, kind: TileKind.UTILITY, nameKey: 'tile.water', price: 150 },
  { index: 29, kind: TileKind.STREET, nameKey: 'tile.novyjArbat', group: ColorGroup.YELLOW, price: 280, rent: rent(24, 48, 120, 360, 850, 1025, 1200) },
  { index: 30, kind: TileKind.GO_TO_JAIL, nameKey: 'tile.goToJail' },
  { index: 31, kind: TileKind.STREET, nameKey: 'tile.sivcevVrazhek', group: ColorGroup.GREEN, price: 300, rent: rent(26, 52, 130, 390, 900, 1100, 1275) },
  { index: 32, kind: TileKind.STREET, nameKey: 'tile.arbat', group: ColorGroup.GREEN, price: 300, rent: rent(26, 52, 130, 390, 900, 1100, 1275) },
  { index: 33, kind: TileKind.CHEST, nameKey: 'tile.chest' },
  { index: 34, kind: TileKind.STREET, nameKey: 'tile.povarskaya', group: ColorGroup.GREEN, price: 320, rent: rent(28, 56, 150, 450, 1000, 1200, 1400) },
  { index: 35, kind: TileKind.STATION, nameKey: 'tile.leningradskij', price: 200 },
  { index: 36, kind: TileKind.CHANCE, nameKey: 'tile.chance' },
  { index: 37, kind: TileKind.STREET, nameKey: 'tile.tverskaya', group: ColorGroup.DARK_BLUE, price: 350, rent: rent(35, 70, 175, 500, 1100, 1300, 1500) },
  { index: 38, kind: TileKind.TAX, nameKey: 'tile.luxuryTax', amount: 100 },
  { index: 39, kind: TileKind.STREET, nameKey: 'tile.malayaBronnaya', group: ColorGroup.DARK_BLUE, price: 400, rent: rent(50, 100, 200, 600, 1400, 1700, 2000) },
];

export const BOARD_SIZE = BOARD.length;
export const JAIL_INDEX: TileIndex = 10;

export function getTile(index: TileIndex): Tile {
  const tile = BOARD[((index % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
  if (!tile) throw new Error(`Tile not found for index ${index}`);
  return tile;
}

export function tilesInGroup(group: ColorGroup): readonly TileIndex[] {
  return BOARD.filter((t) => t.kind === TileKind.STREET && t.group === group).map((t) => t.index);
}

export const STATION_INDICES: readonly TileIndex[] = BOARD.filter(
  (t) => t.kind === TileKind.STATION,
).map((t) => t.index);

export const UTILITY_INDICES: readonly TileIndex[] = BOARD.filter(
  (t) => t.kind === TileKind.UTILITY,
).map((t) => t.index);
