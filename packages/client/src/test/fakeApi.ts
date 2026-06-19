import { initialState, reduce, type GameState } from '@monopoly/core';
import { vi } from 'vitest';
import type { GameApi } from '../game/useGame.js';

export interface FakeApi {
  api: GameApi;
  dispatch: ReturnType<typeof vi.fn>;
}

/** Wrap a GameState in a GameApi with a spy dispatch for component tests. */
export function makeApi(state: GameState, overrides: Partial<GameApi> = {}): FakeApi {
  const dispatch = vi.fn();
  const api: GameApi = {
    state,
    dispatch,
    viewerPlayerId: state.players[state.currentPlayerIndex]?.id ?? null,
    isViewerControlling: true,
    mode: 'local',
    ...overrides,
  };
  return { api, dispatch };
}

/** A two-player game already past the lobby (deterministic seed). */
export function startedState(seed = 12345): GameState {
  let st = initialState(seed);
  st = reduce(st, { type: 'lobby/addPlayer', name: 'Алиса', tokenId: 'hat' });
  st = reduce(st, { type: 'lobby/addPlayer', name: 'Боб', tokenId: 'car' });
  return reduce(st, { type: 'lobby/startGame' });
}

/** Immutably patch a single player by index. */
export function patchPlayer(
  st: GameState,
  index: number,
  patch: Partial<GameState['players'][number]>,
): GameState {
  return { ...st, players: st.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) };
}
