import { useState } from 'react';
import { BOARD, type GameState } from '@monopoly/core';
import { BOARD_VIEWBOX } from './layout.js';
import { Tile } from './Tile.js';
import { Tokens } from './Tokens.js';
import { Ownership } from './Ownership.js';
import { Buildings } from './Buildings.js';
import { CardTooltip } from '../game/CardTooltip.js';

interface BoardProps {
  state?: GameState;
  currentPlayerId?: string | null;
}

export function Board({ state, currentPlayerId = null }: BoardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<TipPos>({ x: 0, y: 0, w: 0, h: 0 });

  return (
    <div
      className="board-wrap"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
      }}
    >
      <svg
        className="board"
        viewBox={`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`}
        role="img"
        aria-label="Игровое поле Монополии"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x={0} y={0} width={BOARD_VIEWBOX} height={BOARD_VIEWBOX} fill="#cfe6d2" />
        {BOARD.map((tile) => (
          <Tile key={tile.index} tile={tile} onHover={setHover} />
        ))}
        <text
          x={BOARD_VIEWBOX / 2}
          y={BOARD_VIEWBOX / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={72}
          fontWeight={800}
          fill="#1a1d22"
          opacity={0.15}
          transform={`rotate(-45 ${BOARD_VIEWBOX / 2} ${BOARD_VIEWBOX / 2})`}
        >
          МОНОПОЛИЯ
        </text>
        {state && <Ownership state={state} />}
        {state && <Buildings state={state} />}
        {state && (
          <Tokens
            players={state.players}
            currentPlayerId={currentPlayerId}
            rollSeq={state.rollSeq}
            lastMove={state.lastMove}
          />
        )}
      </svg>
      {state && hover !== null && (
        <div className="card-tip-anchor" style={{ left: pos.x, top: pos.y, transform: tipTransform(pos) }}>
          <CardTooltip state={state} tileIndex={hover} />
        </div>
      )}
    </div>
  );
}

export interface TipPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Offset the tooltip from the cursor, flipping near the right/bottom edges so
 *  it never spills outside (and gets clipped on the 3D board's overflow:hidden). */
export function tipTransform(pos: TipPos): string {
  const tx = pos.w > 0 && pos.x > pos.w / 2 ? 'calc(-100% - 16px)' : '16px';
  const ty = pos.h > 0 && pos.y > pos.h / 2 ? 'calc(-100% - 16px)' : '16px';
  return `translate(${tx}, ${ty})`;
}
