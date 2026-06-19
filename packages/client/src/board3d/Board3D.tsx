import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { t, type GameState } from '@monopoly/core';
import { Group } from 'three';
import { BOARD_WORLD } from './layout3d.js';
import { BoardSurface } from './BoardSurface.js';
import { Tokens3D } from './Tokens3D.js';
import { Dice3D } from './Dice3D.js';
import { Cards3D } from './Cards3D.js';
import { CardTooltip } from '../game/CardTooltip.js';
import { tipTransform, type TipPos } from '../board/Board.js';

interface Board3DProps {
  state?: GameState | undefined;
  currentPlayerId?: string | null | undefined;
}

/** Isometric 3D view of the board sitting on a rotatable table. */
export function Board3D({ state, currentPlayerId = null }: Board3DProps) {
  // Target rotation of the table, in 90°-ish steps driven by the arrow buttons.
  const [targetAngle, setTargetAngle] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<TipPos>({ x: 0, y: 0, w: 0, h: 0 });

  const rotate = (dir: -1 | 1) => setTargetAngle((a) => a + (dir * Math.PI) / 4);

  return (
    <div
      className="board3d"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
      }}
    >
      <Canvas
        className="board3d__canvas"
        shadows
        orthographic
        camera={{
          position: [BOARD_WORLD * 0.95, BOARD_WORLD * 1.05, BOARD_WORLD * 0.95],
          zoom: 38,
          near: 0.1,
          far: 200,
        }}
      >
        <color attach="background" args={['#1a1d22']} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[BOARD_WORLD, BOARD_WORLD * 1.6, BOARD_WORLD * 0.4]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-BOARD_WORLD}
          shadow-camera-right={BOARD_WORLD}
          shadow-camera-top={BOARD_WORLD}
          shadow-camera-bottom={-BOARD_WORLD}
        />
        <RotatingTable targetAngle={targetAngle}>
          <BoardSurface state={state} onTileHover={setHover} />
          {state && (
            <Tokens3D
              players={state.players}
              currentPlayerId={currentPlayerId}
              rollSeq={state.rollSeq}
              lastMove={state.lastMove}
            />
          )}
          <Dice3D roll={state?.lastRoll ?? null} rollSeq={state?.rollSeq ?? 0} />
          <Cards3D state={state} />
        </RotatingTable>

        {/* Mouse-wheel zoom only; rotation stays on the arrow buttons. */}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableRotate={false}
          enableZoom
          minZoom={18}
          maxZoom={120}
        />
      </Canvas>

      {state && hover !== null && (
        <div className="card-tip-anchor" style={{ left: pos.x, top: pos.y, transform: tipTransform(pos) }}>
          <CardTooltip state={state} tileIndex={hover} />
        </div>
      )}

      <div className="board3d__rotate">
        <button
          type="button"
          className="board3d__rotate-btn"
          onClick={() => rotate(-1)}
          title={t('game.rotateLeft')}
          aria-label={t('game.rotateLeft')}
        >
          ⟲
        </button>
        <button
          type="button"
          className="board3d__rotate-btn"
          onClick={() => rotate(1)}
          title={t('game.rotateRight')}
          aria-label={t('game.rotateRight')}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}

function RotatingTable({
  targetAngle,
  children,
}: {
  targetAngle: number;
  children: React.ReactNode;
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    // Ease the table's Y rotation toward the target angle.
    g.rotation.y += (targetAngle - g.rotation.y) * 0.12;
  });
  return <group ref={ref}>{children}</group>;
}
