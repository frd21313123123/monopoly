import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BOARD_SIZE, playerColor, type Player, type TileIndex } from '@monopoly/core';
import { Group, Vector3 } from 'three';
import { SURFACE_Y, tileWorld, tokenSlotWorld } from './layout3d.js';
import { DICE_ROLL_MS_3D, useMoveGate } from '../anim.js';
import { playLand, playStep } from '../audio/sounds.js';

interface Tokens3DProps {
  players: readonly Player[];
  currentPlayerId: string | null;
  rollSeq: number;
}

/** All player pawns, each animating step-by-step toward its tile. */
export function Tokens3D({ players, currentPlayerId, rollSeq }: Tokens3DProps) {
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
          />
        ))}
    </group>
  );
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
}: {
  player: Player;
  slot: SlotInfo;
  isCurrent: boolean;
  moveGate: React.MutableRefObject<number>;
}) {
  const ref = useRef<Group>(null);
  const logicalTile = useRef<number>(player.position);
  const path = useRef<number[]>([]);
  const segFrom = useRef(new Vector3());
  const segTo = useRef(new Vector3());
  const segStart = useRef(0);
  const segDur = useRef(STEP_MS);
  const directGlide = useRef(false);
  const initialized = useRef(false);
  // While true, a path is queued but waiting for the dice to finish.
  const awaitingGate = useRef(false);

  // Place at the right spot on first mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const { x, z } = tokenSlotWorld(player.position, slot.slot, slot.slotCount);
    ref.current?.position.set(x, PAWN_BASE_Y, z);
  }, [player.position, slot.slot, slot.slotCount]);

  // When the player's tile changes, build a movement path.
  useEffect(() => {
    const last = logicalTile.current;
    const target = player.position;
    if (target === last && path.current.length === 0) return;

    const forward = ((target - last) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
    const backward = BOARD_SIZE - forward;

    let steps: number[] = [];
    let glide = false;
    if (forward === 0) {
      steps = [];
    } else if (forward <= 12) {
      // Normal dice-driven move: walk each tile forward.
      for (let i = 1; i <= forward; i++) steps.push((last + i) % BOARD_SIZE);
    } else if (backward <= 4) {
      // Short backward hop (e.g. "go back 3").
      for (let i = 1; i <= backward; i++) steps.push((last - i + BOARD_SIZE) % BOARD_SIZE);
    } else {
      // Long jump (go to jail, advance to GO from afar): glide straight there.
      steps = [target];
      glide = true;
    }

    if (steps.length > 0) {
      path.current = steps;
      directGlide.current = glide;
      // Defer the first segment until the dice-settle gate has elapsed.
      awaitingGate.current = true;
    }
    logicalTile.current = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position]);

  function startSegment() {
    const g = ref.current;
    if (!g || path.current.length === 0) return;
    const nextTile = path.current[0]!;
    const isLast = path.current.length === 1;
    segFrom.current.copy(g.position);
    const dest = isLast
      ? tokenSlotWorld(nextTile, slot.slot, slot.slotCount)
      : tileWorld(nextTile);
    segTo.current.set(dest.x, PAWN_BASE_Y, dest.z);
    segStart.current = performance.now();
    segDur.current = directGlide.current ? GLIDE_MS : STEP_MS;
    if (!directGlide.current) playStep();
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
    const eased = directGlide.current ? smooth(tnorm) : tnorm;

    g.position.lerpVectors(segFrom.current, segTo.current, eased);
    // Hop while stepping.
    const hopH = directGlide.current ? 0.0 : 0.18;
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
