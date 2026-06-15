import type { TileIndex } from '@monopoly/core';

export const BOARD_VIEWBOX = 1110;
export const CORNER_SIZE = 150;
export const EDGE_LONG = 150;
export const EDGE_SHORT = 90;
export const STRIPE_THICKNESS = 28;

export type TileSide = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export interface TileLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  side: TileSide;
  textRotation: 0 | 90 | 180 | 270;
}

const FAR = BOARD_VIEWBOX - CORNER_SIZE;

export function tileLayout(index: TileIndex): TileLayout {
  if (index === 0) {
    return { x: FAR, y: FAR, width: CORNER_SIZE, height: CORNER_SIZE, side: 'corner', textRotation: 0 };
  }
  if (index >= 1 && index <= 9) {
    const offset = index - 1;
    return {
      x: FAR - EDGE_SHORT * (offset + 1),
      y: FAR,
      width: EDGE_SHORT,
      height: EDGE_LONG,
      side: 'bottom',
      textRotation: 0,
    };
  }
  if (index === 10) {
    return { x: 0, y: FAR, width: CORNER_SIZE, height: CORNER_SIZE, side: 'corner', textRotation: 0 };
  }
  if (index >= 11 && index <= 19) {
    const offset = index - 11;
    return {
      x: 0,
      y: FAR - EDGE_SHORT * (offset + 1),
      width: EDGE_LONG,
      height: EDGE_SHORT,
      side: 'left',
      textRotation: 90,
    };
  }
  if (index === 20) {
    return { x: 0, y: 0, width: CORNER_SIZE, height: CORNER_SIZE, side: 'corner', textRotation: 0 };
  }
  if (index >= 21 && index <= 29) {
    const offset = index - 21;
    return {
      x: CORNER_SIZE + EDGE_SHORT * offset,
      y: 0,
      width: EDGE_SHORT,
      height: EDGE_LONG,
      side: 'top',
      textRotation: 180,
    };
  }
  if (index === 30) {
    return { x: FAR, y: 0, width: CORNER_SIZE, height: CORNER_SIZE, side: 'corner', textRotation: 0 };
  }
  if (index >= 31 && index <= 39) {
    const offset = index - 31;
    return {
      x: FAR,
      y: CORNER_SIZE + EDGE_SHORT * offset,
      width: EDGE_LONG,
      height: EDGE_SHORT,
      side: 'right',
      textRotation: 270,
    };
  }
  throw new Error(`Invalid tile index: ${index}`);
}

export interface StripeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function colorStripe(layout: TileLayout): StripeRect | null {
  switch (layout.side) {
    case 'bottom':
      return { x: layout.x, y: layout.y, width: layout.width, height: STRIPE_THICKNESS };
    case 'left':
      return {
        x: layout.x + layout.width - STRIPE_THICKNESS,
        y: layout.y,
        width: STRIPE_THICKNESS,
        height: layout.height,
      };
    case 'top':
      return {
        x: layout.x,
        y: layout.y + layout.height - STRIPE_THICKNESS,
        width: layout.width,
        height: STRIPE_THICKNESS,
      };
    case 'right':
      return { x: layout.x, y: layout.y, width: STRIPE_THICKNESS, height: layout.height };
    case 'corner':
      return null;
  }
}
