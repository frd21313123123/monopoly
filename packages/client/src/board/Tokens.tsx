import { useEffect, useRef } from 'react';
import { BOARD_SIZE, getToken, playerColor, type Player, type TileIndex } from '@monopoly/core';
import { tileLayout } from './layout.js';
import { DICE_ROLL_MS_2D, useMoveGate } from '../anim.js';
import { playLand, playStep } from '../audio/sounds.js';

interface TokensProps {
  players: readonly Player[];
  currentPlayerId: string | null;
  rollSeq: number;
}

const RADIUS = 18;
const STEP_MS = 180; // walk one tile
const GLIDE_MS = 650; // direct jump (jail / advance to GO from afar)

export function Tokens({ players, currentPlayerId, rollSeq }: TokensProps) {
  const byTile = groupByPosition(players);
  const slotOf = new Map<string, { slot: number; slotCount: number }>();
  for (const occupants of byTile.values()) {
    occupants.forEach((p, i) => slotOf.set(p.id, { slot: i, slotCount: occupants.length }));
  }
  const moveGate = useMoveGate(rollSeq, DICE_ROLL_MS_2D);

  return (
    <g className="tokens-layer">
      {players.map((player) => {
        const s = slotOf.get(player.id)!;
        return (
          <TokenMarker
            key={player.id}
            player={player}
            slot={s.slot}
            slotCount={s.slotCount}
            isCurrent={player.id === currentPlayerId}
            moveGate={moveGate}
          />
        );
      })}
    </g>
  );
}

interface TokenMarkerProps {
  player: Player;
  slot: number;
  slotCount: number;
  isCurrent: boolean;
  moveGate: React.MutableRefObject<number>;
}

function TokenMarker({ player, slot, slotCount, isCurrent, moveGate }: TokenMarkerProps) {
  const gRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number>(0);
  const logicalTile = useRef<number>(player.position);
  // Live animated position; also read by JSX so React re-renders never jump the token.
  const posRef = useRef<Point>(finalPoint(player.position, slot, slotCount));
  // Latest slot info, so a segment ending mid-flight lands in the right slot.
  const slotRef = useRef({ slot, slotCount });
  slotRef.current = { slot, slotCount };

  useEffect(() => {
    const target = player.position;
    const last = logicalTile.current;
    logicalTile.current = target;

    if (target === last) {
      // No move — but the slot may have shifted (another token left/arrived).
      const p = finalPoint(target, slot, slotCount);
      posRef.current = p;
      applyTransform(gRef.current, p, 0);
      return;
    }

    const { steps, glide } = buildPath(last, target);
    if (steps.length === 0) return;
    cancelAnimationFrame(rafRef.current);

    let idx = 0;
    const runSegment = () => {
      const tile = steps[idx]!;
      const isLast = idx === steps.length - 1;
      const from = posRef.current;
      const to = isLast
        ? finalPoint(tile, slotRef.current.slot, slotRef.current.slotCount)
        : walkPoint(tile);
      const dur = glide ? GLIDE_MS : STEP_MS;
      const start = performance.now();
      if (!glide) playStep();

      const tick = (now: number) => {
        const tnorm = Math.min(1, (now - start) / dur);
        const eased = glide ? smooth(tnorm) : tnorm;
        const p = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
        posRef.current = p;
        const hop = glide ? 0 : Math.sin(tnorm * Math.PI) * 10;
        applyTransform(gRef.current, p, hop);
        if (tnorm < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else if (++idx < steps.length) {
          runSegment();
        } else {
          playLand();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    // Wait for the dice to settle before stepping off.
    const waitForGate = () => {
      if (performance.now() >= moveGate.current) {
        runSegment();
      } else {
        rafRef.current = requestAnimationFrame(waitForGate);
      }
    };
    waitForGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position, slot, slotCount]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const token = getToken(player.tokenId);
  if (!token) return null;
  const initial = posRef.current;

  return (
    <g ref={gRef} transform={`translate(${initial.x} ${initial.y})`}>
      <circle
        r={RADIUS}
        fill={playerColor(player)}
        stroke={isCurrent ? '#fff200' : '#1a1d22'}
        strokeWidth={isCurrent ? 4 : 2}
      />
      <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={22}>
        {token.symbol}
      </text>
    </g>
  );
}

interface Point {
  x: number;
  y: number;
}

function applyTransform(g: SVGGElement | null, p: Point, hop: number) {
  g?.setAttribute('transform', `translate(${p.x} ${p.y - hop})`);
}

/** Build the tile-by-tile path from `last` to `target`, mirroring the 3D pawn logic. */
function buildPath(last: number, target: number): { steps: number[]; glide: boolean } {
  const forward = (((target - last) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const backward = BOARD_SIZE - forward;
  const steps: number[] = [];
  if (forward === 0) return { steps, glide: false };
  if (forward <= 12) {
    for (let i = 1; i <= forward; i++) steps.push((last + i) % BOARD_SIZE);
    return { steps, glide: false };
  }
  if (backward <= 4) {
    for (let i = 1; i <= backward; i++) steps.push((last - i + BOARD_SIZE) % BOARD_SIZE);
    return { steps, glide: false };
  }
  return { steps: [target], glide: true };
}

/** Walking anchor (tile centre) used for intermediate steps. */
function walkPoint(tileIndex: TileIndex): Point {
  const { cx, cy } = slotPosition(tileLayout(tileIndex), 0, 1, RADIUS);
  return { x: cx, y: cy };
}

/** Final resting position within the destination tile's slot fan-out. */
function finalPoint(tileIndex: TileIndex, slot: number, slotCount: number): Point {
  const { cx, cy } = slotPosition(tileLayout(tileIndex), slot, slotCount, RADIUS);
  return { x: cx, y: cy };
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

  const offset = slot - (slotCount - 1) / 2;
  return { cx: originX + dx * offset, cy: originY + dy * offset };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
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
