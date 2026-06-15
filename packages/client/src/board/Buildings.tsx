import { HOTEL_LEVEL, type GameState, type TileIndex } from '@monopoly/core';
import { STRIPE_THICKNESS, tileLayout, type TileLayout } from './layout.js';

interface BuildingsProps {
  state: GameState;
}

export function Buildings({ state }: BuildingsProps) {
  return (
    <g className="buildings-layer">
      {Object.entries(state.buildings).map(([key, level]) => {
        const tileIndex = Number(key);
        if (!Number.isFinite(tileIndex) || level <= 0) return null;
        return <TileBuildings key={tileIndex} tileIndex={tileIndex} level={level} />;
      })}
    </g>
  );
}

interface TileBuildingsProps {
  tileIndex: TileIndex;
  level: number;
}

function TileBuildings({ tileIndex, level }: TileBuildingsProps) {
  const layout = tileLayout(tileIndex);
  if (level === HOTEL_LEVEL) {
    return <Hotel layout={layout} />;
  }
  return <Houses layout={layout} count={level} />;
}

function Houses({ layout, count }: { layout: TileLayout; count: number }) {
  const slots = houseSlots(layout, 4);
  return (
    <>
      {slots.slice(0, count).map((slot, i) => (
        <rect
          key={i}
          x={slot.x}
          y={slot.y}
          width={slot.w}
          height={slot.h}
          fill="#1fb25a"
          stroke="#0c5f30"
          strokeWidth={1}
          rx={1.5}
        />
      ))}
    </>
  );
}

function Hotel({ layout }: { layout: TileLayout }) {
  const rect = hotelRect(layout);
  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.w}
      height={rect.h}
      fill="#c12424"
      stroke="#7a0e0e"
      strokeWidth={1.5}
      rx={2}
    />
  );
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HOUSE_SIZE = 14;
const HOUSE_GAP = 3;

function houseSlots(layout: TileLayout, count: number): Rect[] {
  const slots: Rect[] = [];
  if (layout.side === 'corner') return slots;

  const isVertical = layout.side === 'left' || layout.side === 'right';
  const stripeOffset = (STRIPE_THICKNESS - HOUSE_SIZE) / 2;

  if (!isVertical) {
    // bottom/top: stripe spans width
    const bandY = layout.side === 'bottom' ? layout.y + stripeOffset : layout.y + layout.height - STRIPE_THICKNESS + stripeOffset;
    const totalW = count * HOUSE_SIZE + (count - 1) * HOUSE_GAP;
    const startX = layout.x + (layout.width - totalW) / 2;
    for (let i = 0; i < count; i++) {
      slots.push({
        x: startX + i * (HOUSE_SIZE + HOUSE_GAP),
        y: bandY,
        w: HOUSE_SIZE,
        h: HOUSE_SIZE,
      });
    }
  } else {
    // left/right: stripe spans height
    const bandX = layout.side === 'left' ? layout.x + layout.width - STRIPE_THICKNESS + stripeOffset : layout.x + stripeOffset;
    const totalH = count * HOUSE_SIZE + (count - 1) * HOUSE_GAP;
    const startY = layout.y + (layout.height - totalH) / 2;
    for (let i = 0; i < count; i++) {
      slots.push({
        x: bandX,
        y: startY + i * (HOUSE_SIZE + HOUSE_GAP),
        w: HOUSE_SIZE,
        h: HOUSE_SIZE,
      });
    }
  }
  return slots;
}

function hotelRect(layout: TileLayout): Rect {
  const w = HOUSE_SIZE * 2.5;
  const h = HOUSE_SIZE;
  const stripeOffset = (STRIPE_THICKNESS - h) / 2;
  const isVertical = layout.side === 'left' || layout.side === 'right';
  if (!isVertical) {
    const bandY = layout.side === 'bottom' ? layout.y + stripeOffset : layout.y + layout.height - STRIPE_THICKNESS + stripeOffset;
    return { x: layout.x + (layout.width - w) / 2, y: bandY, w, h };
  }
  const bandX = layout.side === 'left' ? layout.x + layout.width - STRIPE_THICKNESS + stripeOffset : layout.x + stripeOffset;
  return { x: bandX, y: layout.y + (layout.height - w) / 2, w: h, h: w };
}
