import { BOARD, type GameState } from '@monopoly/core';
import { BOARD_VIEWBOX } from './layout.js';
import { Tile } from './Tile.js';
import { Tokens } from './Tokens.js';
import { Ownership } from './Ownership.js';
import { Buildings } from './Buildings.js';
import { CardOverlay } from './CardOverlay.js';

interface BoardProps {
  state?: GameState;
  currentPlayerId?: string | null;
}

export function Board({ state, currentPlayerId = null }: BoardProps) {
  return (
    <div className="board-wrap">
      <svg
        className="board"
        viewBox={`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`}
        role="img"
        aria-label="Игровое поле Монополии"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x={0} y={0} width={BOARD_VIEWBOX} height={BOARD_VIEWBOX} fill="#cfe6d2" />
        {BOARD.map((tile) => (
          <Tile key={tile.index} tile={tile} />
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
        {state && <Tokens players={state.players} currentPlayerId={currentPlayerId} />}
      </svg>
      <CardOverlay state={state} />
    </div>
  );
}
