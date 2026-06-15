import { findOwner, getToken, type GameState, type TileIndex } from '@monopoly/core';
import { tileLayout, type TileLayout } from './layout.js';

interface OwnershipProps {
  state: GameState;
}

export function Ownership({ state }: OwnershipProps) {
  const owned = ownedTiles(state);
  return (
    <g className="ownership-layer">
      {owned.map(({ tileIndex, color }) => (
        <OwnerBadge key={tileIndex} tileIndex={tileIndex} color={color} />
      ))}
    </g>
  );
}

interface OwnerBadgeProps {
  tileIndex: TileIndex;
  color: string;
}

function OwnerBadge({ tileIndex, color }: OwnerBadgeProps) {
  const layout = tileLayout(tileIndex);
  const { x, y, size } = badgeRect(layout);
  return (
    <rect
      x={x}
      y={y}
      width={size}
      height={size}
      fill={color}
      stroke="#1a1d22"
      strokeWidth={1.5}
      rx={3}
    />
  );
}

function badgeRect(layout: TileLayout): { x: number; y: number; size: number } {
  const size = 14;
  const inset = 4;
  switch (layout.side) {
    case 'bottom':
      return { x: layout.x + layout.width - size - inset, y: layout.y + inset, size };
    case 'top':
      return {
        x: layout.x + inset,
        y: layout.y + layout.height - size - inset,
        size,
      };
    case 'left':
      return {
        x: layout.x + layout.width - size - inset,
        y: layout.y + layout.height - size - inset,
        size,
      };
    case 'right':
      return { x: layout.x + inset, y: layout.y + inset, size };
    case 'corner':
      return { x: layout.x + inset, y: layout.y + inset, size };
  }
}

function ownedTiles(state: GameState): readonly { tileIndex: TileIndex; color: string }[] {
  const result: { tileIndex: TileIndex; color: string }[] = [];
  for (const tileIndex of allOwnableTileIndices(state)) {
    const owner = findOwner(state, tileIndex);
    if (!owner) continue;
    const token = getToken(owner.tokenId);
    if (!token) continue;
    result.push({ tileIndex, color: token.color });
  }
  return result;
}

function allOwnableTileIndices(state: GameState): readonly TileIndex[] {
  const set = new Set<TileIndex>();
  for (const p of state.players) {
    for (const t of p.ownedTiles) set.add(t);
  }
  return [...set];
}
