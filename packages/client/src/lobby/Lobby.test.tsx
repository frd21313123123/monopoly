import { initialState, reduce, t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Lobby } from './Lobby.js';
import { makeApi } from '../test/fakeApi.js';

function lobbyWith(names: { name: string; tokenId: string }[]) {
  let st = initialState(1);
  for (const p of names) st = reduce(st, { type: 'lobby/addPlayer', ...p });
  return st;
}

describe('Lobby', () => {
  it('shows the empty state with no players', () => {
    const { api } = makeApi(initialState(1));
    render(<Lobby api={api} />);
    expect(screen.getByText('Пока никого нет')).toBeTruthy();
    expect(screen.getByText('Игроки (0)')).toBeTruthy();
  });

  it('disables Add until a name and an untaken token are chosen', () => {
    const { api } = makeApi(initialState(1));
    render(<Lobby api={api} />);
    const addBtn = screen.getByRole('button', { name: t('lobby.add') });
    expect(addBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'Алиса' } });
    expect(addBtn.hasAttribute('disabled')).toBe(true); // no token yet

    fireEvent.click(screen.getByTitle(t('token.hat')));
    expect(addBtn.hasAttribute('disabled')).toBe(false);
  });

  it('dispatches addPlayer with the trimmed name and token', () => {
    const { api, dispatch } = makeApi(initialState(1));
    render(<Lobby api={api} />);
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: '  Алиса  ' } });
    fireEvent.click(screen.getByTitle(t('token.hat')));
    fireEvent.click(screen.getByRole('button', { name: t('lobby.add') }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'lobby/addPlayer',
      name: 'Алиса',
      tokenId: 'hat',
    });
  });

  it('lists added players and dispatches removePlayer', () => {
    const state = lobbyWith([{ name: 'Алиса', tokenId: 'hat' }]);
    const { api, dispatch } = makeApi(state);
    render(<Lobby api={api} />);
    expect(screen.getByText('Алиса')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('lobby.remove') }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'lobby/removePlayer',
      playerId: state.players[0]!.id,
    });
  });

  it('keeps Start disabled below the minimum and enables it with two players', () => {
    const one = makeApi(lobbyWith([{ name: 'A', tokenId: 'hat' }]));
    const { unmount } = render(<Lobby api={one.api} />);
    expect(screen.getByRole('button', { name: t('lobby.start') }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText(t('lobby.minPlayers'))).toBeTruthy();
    unmount();

    const two = makeApi(
      lobbyWith([
        { name: 'A', tokenId: 'hat' },
        { name: 'B', tokenId: 'car' },
      ]),
    );
    render(<Lobby api={two.api} />);
    const startBtn = screen.getByRole('button', { name: t('lobby.start') });
    expect(startBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(startBtn);
    expect(two.dispatch).toHaveBeenCalledWith({ type: 'lobby/startGame' });
  });
});
