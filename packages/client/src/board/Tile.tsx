import { t, TileKind, type Tile as TileData } from '@monopoly/core';
import { GROUP_COLORS } from './colors.js';
import { colorStripe, tileLayout, type TileLayout } from './layout.js';

interface TileProps {
  tile: TileData;
}

export function Tile({ tile }: TileProps) {
  const layout = tileLayout(tile.index);
  const cx = layout.x + layout.width / 2;
  const cy = layout.y + layout.height / 2;

  return (
    <g>
      <rect
        x={layout.x}
        y={layout.y}
        width={layout.width}
        height={layout.height}
        fill="#fbf8ef"
        stroke="#1a1d22"
        strokeWidth={1.5}
      />
      {tile.kind === TileKind.STREET && <Stripe layout={layout} color={GROUP_COLORS[tile.group]} />}
      {layout.side === 'corner'
        ? <CornerContent label={t(tile.nameKey)} cx={cx} cy={cy} />
        : <EdgeContent tile={tile} layout={layout} cx={cx} cy={cy} />}
    </g>
  );
}

function Stripe({ layout, color }: { layout: TileLayout; color: string }) {
  const stripe = colorStripe(layout);
  if (!stripe) return null;
  return (
    <rect
      x={stripe.x}
      y={stripe.y}
      width={stripe.width}
      height={stripe.height}
      fill={color}
      stroke="#1a1d22"
      strokeWidth={1.5}
    />
  );
}

function CornerContent({ label, cx, cy }: { label: string; cx: number; cy: number }) {
  const lines = label.split(' ');
  const offset = -(lines.length - 1) * 8;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={14}
      fontWeight={700}
      fill="#1a1d22"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={cx} dy={i === 0 ? offset : 16}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function EdgeContent({
  tile,
  layout,
  cx,
  cy,
}: {
  tile: TileData;
  layout: TileLayout;
  cx: number;
  cy: number;
}) {
  const transform = `rotate(${layout.textRotation} ${cx} ${cy})`;
  const lines = wrapLabel(t(tile.nameKey));
  const nameDyStart = -(lines.length - 1) * 6;
  return (
    <g transform={transform}>
      <text
        x={cx}
        y={cy - 30}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={tile.kind === TileKind.STREET ? 11 : 12}
        fontWeight={600}
        fill="#1a1d22"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? nameDyStart : 12}>
            {line}
          </tspan>
        ))}
      </text>
      {hasPrice(tile) && (
        <text
          x={cx}
          y={cy + 50}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fill="#3a3f47"
        >
          ₽{getPrice(tile)}
        </text>
      )}
      <Glyph tile={tile} cx={cx} cy={cy + 6} />
    </g>
  );
}

function wrapLabel(label: string): string[] {
  if (label.length <= 14) return [label];
  const words = label.split(' ');
  if (words.length === 1) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function hasPrice(tile: TileData): boolean {
  return (
    tile.kind === TileKind.STREET ||
    tile.kind === TileKind.STATION ||
    tile.kind === TileKind.UTILITY
  );
}

function getPrice(tile: TileData): number {
  if (
    tile.kind === TileKind.STREET ||
    tile.kind === TileKind.STATION ||
    tile.kind === TileKind.UTILITY
  ) {
    return tile.price;
  }
  return 0;
}

function Glyph({ tile, cx, cy }: { tile: TileData; cx: number; cy: number }) {
  const common = { x: cx, y: cy, textAnchor: 'middle' as const, dominantBaseline: 'middle' as const };
  switch (tile.kind) {
    case TileKind.STATION:
      return <text {...common} fontSize={28}>🚂</text>;
    case TileKind.UTILITY:
      return (
        <text {...common} fontSize={24}>
          {tile.nameKey === 'tile.electric' ? '💡' : '🚰'}
        </text>
      );
    case TileKind.CHANCE:
      return (
        <text {...common} fontSize={32} fill="#d96a1c" fontWeight={800}>
          ?
        </text>
      );
    case TileKind.CHEST:
      return <text {...common} fontSize={24}>📦</text>;
    case TileKind.TAX:
      return <text {...common} fontSize={20}>💰</text>;
    default:
      return null;
  }
}
