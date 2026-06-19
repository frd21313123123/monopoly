import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BOARD_SIZE, playerColor, type GameState, type Player, type TileIndex } from '@monopoly/core';
import { Group, Vector3 } from 'three';
import { SURFACE_Y, tileWorld, tokenSlotWorld } from './layout3d.js';
import { DICE_ROLL_MS_3D, useMoveGate } from '../anim.js';
import { playLand, playStep } from '../audio/sounds.js';

type LastMove = GameState['lastMove'];

interface Tokens3DProps {
  players: readonly Player[];
  currentPlayerId: string | null;
  rollSeq: number;
  lastMove: LastMove;
}

/** All player pawns, each animating step-by-step toward its tile. */
export function Tokens3D({ players, currentPlayerId, rollSeq, lastMove }: Tokens3DProps) {
  // Final slot assignment per player, based on current (target) positions.
  const slots = useMemo(() => assignSlots(players), [players]);
  // Pawns must not start walking until the dice have settled.
  const moveGate = useMoveGate(rollSeq, DICE_ROLL_MS_3D);

  return (
    <group>
      {players
        .filter((p) => !p.bankrupt)
        .map((p) => (
          <Pawn
            key={p.id}
            player={p}
            slot={slots.get(p.id)!}
            isCurrent={p.id === currentPlayerId}
            moveGate={moveGate}
            lastMove={lastMove}
          />
        ))}
    </group>
  );
}

interface Segment {
  tile: number;
  glide: boolean;
}

/** Tile-by-tile path for one leg, mirroring the 2D pawn logic. */
function legPath(last: number, target: number): Segment[] {
  const forward = ((target - last) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
  const backward = BOARD_SIZE - forward;
  const out: Segment[] = [];
  if (forward === 0) return out;
  if (forward <= 12) {
    for (let i = 1; i <= forward; i++) out.push({ tile: (last + i) % BOARD_SIZE, glide: false });
  } else if (backward <= 4) {
    for (let i = 1; i <= backward; i++) out.push({ tile: (last - i + BOARD_SIZE) % BOARD_SIZE, glide: false });
  } else {
    out.push({ tile: target, glide: true });
  }
  return out;
}

/** Chain `legPath` across every waypoint into one segment list. */
function flattenPath(from: number, waypoints: readonly number[]): Segment[] {
  const out: Segment[] = [];
  let prev = from;
  for (const w of waypoints) {
    out.push(...legPath(prev, w));
    prev = w;
  }
  return out;
}

interface SlotInfo {
  slot: number;
  slotCount: number;
}

function assignSlots(players: readonly Player[]): Map<string, SlotInfo> {
  const byTile = new Map<TileIndex, Player[]>();
  for (const p of players) {
    if (p.bankrupt) continue;
    const list = byTile.get(p.position) ?? [];
    list.push(p);
    byTile.set(p.position, list);
  }
  const result = new Map<string, SlotInfo>();
  for (const occupants of byTile.values()) {
    occupants.forEach((p, i) => result.set(p.id, { slot: i, slotCount: occupants.length }));
  }
  return result;
}

const PAWN_BASE_Y = SURFACE_Y + 0.02;
const STEP_MS = 200; // per-tile walk
const GLIDE_MS = 650; // direct teleport (jail / long jump)

function Pawn({
  player,
  slot,
  isCurrent,
  moveGate,
  lastMove,
}: {
  player: Player;
  slot: SlotInfo;
  isCurrent: boolean;
  moveGate: React.MutableRefObject<number>;
  lastMove: LastMove;
}) {
  const ref = useRef<Group>(null);
  const logicalTile = useRef<number>(player.position);
  const path = useRef<Segment[]>([]);
  const segFrom = useRef(new Vector3());
  const segTo = useRef(new Vector3());
  const segStart = useRef(0);
  const segDur = useRef(STEP_MS);
  const segGlide = useRef(false);
  const initialized = useRef(false);
  // While true, a path is queued but waiting for the dice to finish.
  const awaitingGate = useRef(false);
  const prevMoveSeq = useRef<number | null>(lastMove?.seq ?? null);

  // Place at the right spot on first mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const { x, z } = tokenSlotWorld(player.position, slot.slot, slot.slotCount);
    ref.current?.position.set(x, PAWN_BASE_Y, z);
  }, [player.position, slot.slot, slot.slotCount]);

  // When the player's tile changes, build a movement path. If this pawn is the
  // one that moved, replay the recorded multi-leg waypoints (dice → "Go To Jail"
  // → jail) so the redirect animates instead of teleporting.
  useEffect(() => {
    const last = logicalTile.current;
    const target = player.position;
    const moveSeq = lastMove?.seq ?? null;
    const seqChanged = moveSeq !== null && moveSeq !== prevMoveSeq.current;
    prevMoveSeq.current = moveSeq;
    const isMover = seqChanged && lastMove?.playerId === player.id;

    const segs = isMover && lastMove && lastMove.path.length > 0
      ? flattenPath(last, lastMove.path)
      : target !== last
        ? flattenPath(last, [target])
        : [];

    if (segs.length > 0) {
      path.current = segs;
      // Defer the first segment until the dice-settle gate has elapsed.
      awaitingGate.current = true;
    }
    logicalTile.current = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position, lastMove?.seq]);

  function startSegment() {
    const g = ref.current;
    if (!g || path.current.length === 0) return;
    const seg = path.current[0]!;
    const isLast = path.current.length === 1;
    segFrom.current.copy(g.position);
    const dest = isLast
      ? tokenSlotWorld(seg.tile, slot.slot, slot.slotCount)
      : tileWorld(seg.tile);
    segTo.current.set(dest.x, PAWN_BASE_Y, dest.z);
    segStart.current = performance.now();
    segGlide.current = seg.glide;
    segDur.current = seg.glide ? GLIDE_MS : STEP_MS;
    if (!seg.glide) playStep();
  }

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    // Hold a queued path until the dice have settled.
    if (awaitingGate.current) {
      if (performance.now() < moveGate.current) return;
      awaitingGate.current = false;
      startSegment();
    }
    if (path.current.length === 0) return;
    const elapsed = performance.now() - segStart.current;
    const tnorm = Math.min(1, elapsed / segDur.current);
    const eased = segGlide.current ? smooth(tnorm) : tnorm;

    g.position.lerpVectors(segFrom.current, segTo.current, eased);
    // Hop while stepping.
    const hopH = segGlide.current ? 0.0 : 0.18;
    g.position.y = PAWN_BASE_Y + Math.sin(tnorm * Math.PI) * hopH;

    if (tnorm >= 1) {
      path.current.shift();
      if (path.current.length > 0) startSegment();
      else {
        g.position.y = PAWN_BASE_Y;
        playLand();
      }
    }
  });

  const color = playerColor(player);

  return (
    <group ref={ref} position={[0, PAWN_BASE_Y, 0]}>
      {/* Base */}
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Body */}
      <mesh castShadow position={[0, 0.28, 0]}>
        <coneGeometry args={[0.16, 0.34, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Highlight ring for the active player */}
      {isCurrent && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.32, 28]} />
          <meshStandardMaterial color="#fff200" emissive="#fff200" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  );
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
