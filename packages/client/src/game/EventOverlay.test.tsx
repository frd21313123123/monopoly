import { t, type GameState, type LogEntry } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventOverlay } from './EventOverlay.js';
import { makeApi, startedState } from '../test/fakeApi.js';

function withLog(base: GameState, entries: LogEntry[]): GameState {
  // Append on top of whatever the game already logged (startGame logs an entry),
  // bumping logSeq by the number of new entries — that's how the overlay detects
  // fresh events.
  return { ...base, log: [...base.log, ...entries], logSeq: base.logSeq + entries.length };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('EventOverlay', () => {
  it('renders nothing initially', () => {
    const { api } = makeApi(startedState());
    const { container } = render(<EventOverlay api={api} />);
    expect(container.firstChild).toBeNull();
  });

  it('pops a personal event for the acting viewer when a new log entry arrives', () => {
    const base = startedState();
    const viewerId = base.players[0]!.id;
    const start = makeApi(base, { viewerPlayerId: viewerId });
    const { rerender } = render(<EventOverlay api={start.api} />);

    const entry: LogEntry = {
      turn: 1,
      playerId: viewerId,
      messageKey: 'log.taxOwed',
      params: { name: 'Алиса', amount: 200 },
    };
    const next = makeApi(withLog(base, [entry]), { viewerPlayerId: viewerId });
    rerender(<EventOverlay api={next.api} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(t('log.taxOwed', entry.params))).toBeTruthy();
  });

  it('ignores another player’s personal event', () => {
    const base = startedState();
    const viewerId = base.players[0]!.id;
    const otherId = base.players[1]!.id;
    const start = makeApi(base, { viewerPlayerId: viewerId });
    const { rerender } = render(<EventOverlay api={start.api} />);

    const entry: LogEntry = {
      turn: 1,
      playerId: otherId,
      messageKey: 'log.rentOwed',
      params: { name: 'Боб', amount: 50, owner: 'Алиса', tile: 'tile.marosejka' },
    };
    const next = makeApi(withLog(base, [entry]), { viewerPlayerId: viewerId });
    rerender(<EventOverlay api={next.api} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows game-over to every viewer regardless of who acted', () => {
    const base = startedState();
    const viewerId = base.players[0]!.id;
    const start = makeApi(base, { viewerPlayerId: viewerId });
    const { rerender } = render(<EventOverlay api={start.api} />);

    const entry: LogEntry = {
      turn: 1,
      playerId: base.players[1]!.id,
      messageKey: 'log.gameWon',
      params: { name: 'Боб' },
    };
    const next = makeApi(withLog(base, [entry]), { viewerPlayerId: viewerId });
    rerender(<EventOverlay api={next.api} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(t('log.gameWon', { name: 'Боб' }))).toBeTruthy();
  });

  it('closes the current popup after the leave animation', () => {
    vi.useFakeTimers();
    const base = startedState();
    const viewerId = base.players[0]!.id;
    const start = makeApi(base, { viewerPlayerId: viewerId });
    const { rerender } = render(<EventOverlay api={start.api} />);

    const entry: LogEntry = {
      turn: 1,
      playerId: viewerId,
      messageKey: 'log.taxOwed',
      params: { name: 'Алиса', amount: 200 },
    };
    const next = makeApi(withLog(base, [entry]), { viewerPlayerId: viewerId });
    rerender(<EventOverlay api={next.api} />);

    fireEvent.click(screen.getByRole('button', { name: t('game.ok') }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
