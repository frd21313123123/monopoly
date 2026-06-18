import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { t, type GameState, type LogEntry } from '@monopoly/core';
import { Group } from 'three';
import { HALF, SURFACE_Y } from './layout3d.js';

/** Two decks resting on the board; the top card animates out when drawn. */
interface Cards3DProps {
  state?: GameState | undefined;
}

interface DeckConfig {
  key: 'chance' | 'chest';
  drewKey: string;
  pos: [number, number];
  color: string;
  rotY: number;
  title: string;
}

const DECKS: DeckConfig[] = [
  {
    key: 'chance',
    drewKey: 'log.drewChance',
    pos: [HALF * 0.34, -HALF * 0.34],
    color: '#e8943a',
    rotY: Math.PI / 4,
    title: 'Шанс',
  },
  {
    key: 'chest',
    drewKey: 'log.drewChest',
    pos: [-HALF * 0.34, HALF * 0.34],
    color: '#4a90d9',
    rotY: Math.PI / 4,
    title: 'Казна',
  },
];

export function Cards3D({ state }: Cards3DProps) {
  return (
    <group>
      {DECKS.map((d) => (
        <Deck key={d.key} config={d} log={state?.log ?? []} />
      ))}
    </group>
  );
}

const DECK_Y = SURFACE_Y + 0.04;
const CARD_W = 1.0;
const CARD_H = 1.4;
const LIFT_H = 2.0;

// Animation timeline (ms): rise off the stack → hold (read) → settle back.
const T_RISE = 600;
const T_HOLD = 2600;
const T_RETURN = 600;
const T_TOTAL = T_RISE + T_HOLD + T_RETURN;

function lastDraw(log: readonly LogEntry[], drewKey: string): { idx: number; text: string } | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.messageKey === drewKey) {
      const text = e.params?.text;
      return { idx: i, text: typeof text === 'string' ? text : '' };
    }
  }
  return null;
}

function Deck({ config, log }: { config: DeckConfig; log: readonly LogEntry[] }) {
  const cardRef = useRef<Group>(null);
  const animStart = useRef<number>(-Infinity);
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const seenIdx = useRef<number>(-1);

  useEffect(() => {
    const draw = lastDraw(log, config.drewKey);
    if (!draw) return;
    // First render after mount: remember where the deck is without animating.
    if (seenIdx.current === -1 && !active) {
      seenIdx.current = draw.idx;
      return;
    }
    if (draw.idx !== seenIdx.current) {
      seenIdx.current = draw.idx;
      setText(t(draw.text));
      setActive(true);
      animStart.current = performance.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, config.drewKey]);

  useFrame(() => {
    const g = cardRef.current;
    if (!g || !active) return;
    const e = performance.now() - animStart.current;
    if (e >= T_TOTAL) {
      setActive(false);
      return;
    }

    let rise: number;
    if (e < T_RISE) {
      rise = smooth(e / T_RISE);
    } else if (e < T_RISE + T_HOLD) {
      rise = 1;
    } else {
      rise = 1 - smooth((e - T_RISE - T_HOLD) / T_RETURN);
    }

    g.position.set(0, 0.07 + rise * LIFT_H, 0);
    // Gentle scale-up as it lifts so the text is comfortably readable.
    const s = 1 + rise * 0.9;
    g.scale.set(s, 1, s);
  });

  const [px, pz] = config.pos;

  return (
    <group position={[px, DECK_Y, pz]} rotation={[0, config.rotY, 0]}>
      {/* Resting deck stack */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[CARD_W, 0.08, CARD_H]} />
        <meshStandardMaterial color={config.color} roughness={0.6} />
      </mesh>
      <Text
        position={[0, 0.07, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#fff"
        anchorX="center"
        anchorY="middle"
      >
        {config.title}
      </Text>

      {/* The drawn card — rises off the stack with its face up toward the camera. */}
      {active && (
        <group ref={cardRef} position={[0, 0.07, 0]}>
          {/* Card body */}
          <mesh castShadow>
            <boxGeometry args={[CARD_W, 0.02, CARD_H]} />
            <meshStandardMaterial color="#fbf8ef" roughness={0.5} />
          </mesh>
          {/* Colored header bar at the top of the card */}
          <mesh position={[0, 0.012, -CARD_H / 2 + CARD_H * 0.12]}>
            <boxGeometry args={[CARD_W, 0.005, CARD_H * 0.22]} />
            <meshStandardMaterial color={config.color} roughness={0.5} />
          </mesh>
          {/* Deck title on the header */}
          <Text
            position={[0, 0.02, -CARD_H / 2 + CARD_H * 0.12]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.11}
            color="#fff"
            anchorX="center"
            anchorY="middle"
          >
            {config.title}
          </Text>
          {/* Card text on the TOP face — always faces the camera. */}
          <Text
            position={[0, 0.02, CARD_H * 0.06]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.092}
            maxWidth={CARD_W * 0.82}
            lineHeight={1.15}
            textAlign="center"
            color="#1a1d22"
            anchorX="center"
            anchorY="middle"
          >
            {text}
          </Text>
        </group>
      )}
    </group>
  );
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
