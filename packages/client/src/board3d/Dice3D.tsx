import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type { DiceRoll } from '@monopoly/core';
import { Group, Quaternion, Euler, Vector3 } from 'three';
import { HALF, SURFACE_Y } from './layout3d.js';

const ROLL_MS = 1500;
const DIE_SIZE = 0.6;
const REST_Y = SURFACE_Y + DIE_SIZE / 2 + 0.02;

/** Euler orientation (radians) that brings a given face value to the top (+Y).
 * Face layout: +Y=1, -Y=6, +X=2, -X=5, +Z=3, -Z=4 (opposite faces sum to 7). */
const FACE_UP: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [0, 0, -Math.PI / 2],
  5: [0, 0, Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
};

interface Dice3DProps {
  roll: DiceRoll | null;
  rollSeq: number;
}

/** Two tumbling dice that settle to show the values of `roll` (3s animation). */
export function Dice3D({ roll, rollSeq }: Dice3DProps) {
  const [seed, setSeed] = useState(0);
  const prevSeqRef = useRef<number>(rollSeq);
  const startRef = useRef<number>(-Infinity);

  // Re-run the tumble only when a real roll happens (rollSeq bumps), not on every
  // network state update (which hands us a fresh `roll` object each time).
  useEffect(() => {
    if (rollSeq !== prevSeqRef.current) {
      prevSeqRef.current = rollSeq;
      startRef.current = performance.now();
      setSeed((s) => s + 1);
    }
  }, [rollSeq]);

  if (!roll) return null;

  return (
    <group position={[0, 0, HALF * 0.32]}>
      <Die value={roll.a} offsetX={-DIE_SIZE * 0.9} startRef={startRef} seed={seed} spinAxis={0} />
      <Die value={roll.b} offsetX={DIE_SIZE * 0.9} startRef={startRef} seed={seed} spinAxis={1} />
    </group>
  );
}

interface DieProps {
  value: number;
  offsetX: number;
  startRef: React.MutableRefObject<number>;
  seed: number;
  spinAxis: number;
}

function Die({ value, offsetX, startRef, seed, spinAxis }: DieProps) {
  const ref = useRef<Group>(null);
  const targetQuat = useRef(new Quaternion());
  const fromQuat = useRef(new Quaternion());
  const tmpQuat = useRef(new Quaternion());

  // Each new roll picks a different tumbling axis/speed so it looks random.
  const spin = useRef({ ax: new Vector3(), speed: 0 });
  useEffect(() => {
    const target = new Euler(...FACE_UP[value]!);
    targetQuat.current.setFromEuler(target);
    // Random-ish but seed-driven so SSR/determinism isn't required here.
    const a = (seed * 1.37 + spinAxis * 2.1) % (Math.PI * 2);
    spin.current.ax.set(Math.cos(a), 0.6, Math.sin(a)).normalize();
    spin.current.speed = 12 + ((seed * 7 + spinAxis * 3) % 6);
    fromQuat.current.copy(targetQuat.current);
  }, [seed, value, spinAxis]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const elapsed = performance.now() - startRef.current;
    if (elapsed < 0) return;

    if (elapsed < ROLL_MS) {
      const tnorm = elapsed / ROLL_MS;
      // Tumble fast, decelerating toward the end.
      const decel = 1 - tnorm * tnorm;
      const angle = spin.current.speed * decel * 0.12;
      tmpQuat.current.setFromAxisAngle(spin.current.ax, angle);
      g.quaternion.multiply(tmpQuat.current);
      // Little hop.
      const hop = Math.abs(Math.sin(tnorm * Math.PI * 6)) * (1 - tnorm) * 0.5;
      g.position.set(offsetX, REST_Y + hop, 0);
    } else {
      // Settle smoothly to the final face-up orientation.
      g.quaternion.slerp(targetQuat.current, 0.18);
      g.position.set(offsetX, REST_Y, 0);
    }
  });

  return (
    <group ref={ref} position={[offsetX, REST_Y, 0]}>
      <RoundedBox args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} radius={0.08} smoothness={3} castShadow>
        <meshStandardMaterial color="#faf7f0" roughness={0.35} />
      </RoundedBox>
      <Pips value={1} normal={[0, 1, 0]} />
      <Pips value={6} normal={[0, -1, 0]} />
      <Pips value={2} normal={[1, 0, 0]} />
      <Pips value={5} normal={[-1, 0, 0]} />
      <Pips value={3} normal={[0, 0, 1]} />
      <Pips value={4} normal={[0, 0, -1]} />
    </group>
  );
}

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

/** Render the pips for one face, given its outward normal. */
function Pips({ value, normal }: { value: number; normal: [number, number, number] }) {
  const half = DIE_SIZE / 2 + 0.005;
  const spread = DIE_SIZE * 0.28;
  const [nx, ny, nz] = normal;
  // Build two in-plane axes (u, v) orthogonal to the normal.
  let u: [number, number, number];
  let v: [number, number, number];
  if (ny !== 0) {
    u = [1, 0, 0];
    v = [0, 0, 1];
  } else if (nx !== 0) {
    u = [0, 1, 0];
    v = [0, 0, 1];
  } else {
    u = [1, 0, 0];
    v = [0, 1, 0];
  }

  return (
    <group>
      {PIP_LAYOUT[value]!.map(([pu, pv], i) => {
        const x = nx * half + (u[0] * pu + v[0] * pv) * spread;
        const y = ny * half + (u[1] * pu + v[1] * pv) * spread;
        const z = nz * half + (u[2] * pu + v[2] * pv) * spread;
        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color="#1a1d22" roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}
