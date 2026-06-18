import type { TileIndex } from '@monopoly/core';
import {
  BOARD_VIEWBOX,
  CORNER_SIZE,
  EDGE_SHORT,
  tileLayout,
  type TileSide,
} from '../board/layout.js';

/**
 * 3D board geometry. The board lies flat in the XZ plane (Y is up).
 * Everything — tiles, tokens, dice, cards — derives its position from
 * `tileLayout` (the 2D source of truth) so the two renderers never drift apart.
 */

/** World size of the board edge in three.js units. */
export const BOARD_WORLD = 11;
/** Scale factor: 2D SVG units → world units. */
export const SCALE = BOARD_WORLD / BOARD_VIEWBOX;
/** Half the board, in world units (board spans [-HALF, +HALF]). */
export const HALF = BOARD_WORLD / 2;
/** Thickness of the board slab. */
export const BOARD_THICKNESS = 0.3;
/** Y of the playable top surface of the board. */
export const SURFACE_Y = BOARD_THICKNESS / 2;

export interface TileWorld {
  /** Center of the tile on the board surface. */
  x: number;
  z: number;
  /** Tile footprint in world units. */
  w: number;
  d: number;
  side: TileSide;
  /** Y rotation (radians) so "up" on the tile faces the board interior. */
  rotY: number;
}

function svgToWorldX(svgX: number): number {
  return (svgX - BOARD_VIEWBOX / 2) * SCALE;
}
function svgToWorldZ(svgY: number): number {
  return (svgY - BOARD_VIEWBOX / 2) * SCALE;
}

const SIDE_ROT: Record<TileSide, number> = {
  bottom: 0,
  left: Math.PI / 2,
  top: Math.PI,
  right: -Math.PI / 2,
  corner: 0,
};

export function tileWorld(index: TileIndex): TileWorld {
  const l = tileLayout(index);
  const cx = l.x + l.width / 2;
  const cy = l.y + l.height / 2;
  return {
    x: svgToWorldX(cx),
    z: svgToWorldZ(cy),
    w: l.width * SCALE,
    d: l.height * SCALE,
    side: l.side,
    rotY: SIDE_ROT[l.side],
  };
}

/**
 * Position of a token standing on a tile, offset into a slot so that several
 * tokens on the same tile don't overlap. Mirrors `slotPosition` in Tokens.tsx
 * but in world space.
 */
export function tokenSlotWorld(
  index: TileIndex,
  slot: number,
  slotCount: number,
): { x: number; z: number } {
  const tile = tileWorld(index);
  const spread = EDGE_SHORT * SCALE * 0.32;
  const offset = slot - (slotCount - 1) / 2;

  if (tile.side === 'corner') {
    const step = CORNER_SIZE * SCALE * 0.22;
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    return {
      x: tile.x - step / 2 + col * step,
      z: tile.z - step / 2 + row * step,
    };
  }

  // Spread perpendicular to the direction the tiles run along the edge.
  if (tile.side === 'bottom' || tile.side === 'top') {
    return { x: tile.x + offset * spread, z: tile.z };
  }
  return { x: tile.x, z: tile.z + offset * spread };
}
