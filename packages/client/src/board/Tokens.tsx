import { getToken, type Player, type TileIndex } from '@monopoly/core';
import { tileLayout } from './layout.js';

interface TokensProps {
  players: readonly Player[];
  currentPlayerId: string | null;
}

export function Tokens({ players, currentPlayerId }: TokensProps) {
  const byTile = groupByPosition(players);
  return (
    <g className="tokens-layer">
      {[...byTile.entries()].flatMap(([tileIndex, occupants]) =>
        occupants.map((player, i) => (
          <TokenMarker
            key={player.id}
            player={player}
            tileIndex={tileIndex}
            slot={i}
            slotCount={occupants.length}
            isCurrent={player.id === currentPlayerId}
          />
        )),
      )}
    </g>
  );
}

interface TokenMarkerProps {
  player: Player;
  tileIndex: TileIndex;
  slot: number;
  slotCount: number;
  isCurrent: boolean;
}

function TokenMarker({ player, tileIndex, slot, slotCount, isCurrent }: TokenMarkerProps) {
  const layout = tileLayout(tileIndex);
  const token = getToken(player.tokenId);
  if (!token) return null;

  const radius = 18;
  const { cx, cy } = slotPosition(layout, slot, slotCount, radius);

  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle
        r={radius}
        fill={token.color}
        stroke={isCurrent ? '#fff200' : '#1a1d22'}
        strokeWidth={isCurrent ? 4 : 2}
      />
      <text
        x={0}
        y={1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={22}
      >
        {token.symbol}
      </text>
    </g>
  );
}

interface SlotPos {
  cx: number;
  cy: number;
}

function slotPosition(
  layout: ReturnType<typeof tileLayout>,
  slot: number,
  slotCount: number,
  radius: number,
): SlotPos {
  const padding = 6;
  const innerMargin = 30;

  let originX: number;
  let originY: number;
  let dx: number;
  let dy: number;

  switch (layout.side) {
    case 'bottom':
      originX = layout.x + layout.width / 2;
      originY = layout.y + innerMargin + radius + padding;
      dx = 0;
      dy = (radius * 2 + padding) * 0.7;
      break;
    case 'top':
      originX = layout.x + layout.width / 2;
      originY = layout.y + layout.height - innerMargin - radius - padding;
      dx = 0;
      dy = -(radius * 2 + padding) * 0.7;
      break;
    case 'left':
      originX = layout.x + innerMargin + radius + padding;
      originY = layout.y + layout.height / 2;
      dx = (radius * 2 + padding) * 0.7;
      dy = 0;
      break;
    case 'right':
      originX = layout.x + layout.width - innerMargin - radius - padding;
      originY = layout.y + layout.height / 2;
      dx = -(radius * 2 + padding) * 0.7;
      dy = 0;
      break;
    case 'corner': {
      const cornerX = layout.x + layout.width / 2;
      const cornerY = layout.y + layout.height / 2;
      const col = slot % 2;
      const row = Math.floor(slot / 2);
      const step = (radius * 2 + padding) / 2;
      return {
        cx: cornerX - step / 2 + col * step,
        cy: cornerY - step / 2 + row * step,
      };
    }
  }

  const offset = (slot - (slotCount - 1) / 2);
  return { cx: originX + dx * offset, cy: originY + dy * offset };
}

function groupByPosition(players: readonly Player[]): Map<TileIndex, Player[]> {
  const map = new Map<TileIndex, Player[]>();
  for (const player of players) {
    const list = map.get(player.position) ?? [];
    list.push(player);
    map.set(player.position, list);
  }
  return map;
}
