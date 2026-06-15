import { useReducer } from 'react';
import { initialState, reduce, type Action, type GameState } from '@monopoly/core';

export interface GameApi {
  state: GameState;
  dispatch: (action: Action) => void;
  /** Whose perspective is the UI rendering from? In hot-seat mode, this is the current player. */
  viewerPlayerId: string | null;
  /** Whether this client is the controlling agent for the viewer (always true in hot-seat). */
  isViewerControlling: boolean;
  mode: 'local' | 'network';
}

export function useGame(seed?: number): GameApi {
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(seed));
  const viewerPlayerId = state.players[state.currentPlayerIndex]?.id ?? null;
  return {
    state,
    dispatch,
    viewerPlayerId,
    isViewerControlling: true,
    mode: 'local',
  };
}
