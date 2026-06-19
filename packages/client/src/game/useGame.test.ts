import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGame } from './useGame.js';

describe('useGame (local hot-seat)', () => {
  it('starts in the lobby with no viewer', () => {
    const { result } = renderHook(() => useGame(12345));
    expect(result.current.state.phase).toBe('lobby');
    expect(result.current.viewerPlayerId).toBeNull();
    expect(result.current.mode).toBe('local');
    expect(result.current.isViewerControlling).toBe(true);
  });

  it('dispatch drives the reducer', () => {
    const { result } = renderHook(() => useGame(12345));
    act(() => {
      result.current.dispatch({ type: 'lobby/addPlayer', name: 'Алиса', tokenId: 'hat' });
    });
    act(() => {
      result.current.dispatch({ type: 'lobby/addPlayer', name: 'Боб', tokenId: 'car' });
    });
    expect(result.current.state.players).toHaveLength(2);

    act(() => {
      result.current.dispatch({ type: 'lobby/startGame' });
    });
    expect(result.current.state.phase).toBe('playing');
  });

  it('viewerPlayerId follows the current player in hot-seat mode', () => {
    const { result } = renderHook(() => useGame(12345));
    act(() => {
      result.current.dispatch({ type: 'lobby/addPlayer', name: 'Алиса', tokenId: 'hat' });
    });
    act(() => {
      result.current.dispatch({ type: 'lobby/addPlayer', name: 'Боб', tokenId: 'car' });
    });
    act(() => {
      result.current.dispatch({ type: 'lobby/startGame' });
    });
    const current = result.current.state.players[result.current.state.currentPlayerIndex];
    expect(result.current.viewerPlayerId).toBe(current!.id);
  });

  it('produces the same initial state for the same seed', () => {
    const a = renderHook(() => useGame(999));
    const b = renderHook(() => useGame(999));
    expect(a.result.current.state.rngState).toBe(b.result.current.state.rngState);
  });
});
