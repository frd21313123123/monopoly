import { HOUSE_COST, t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Properties } from './Properties.js';
import { makeApi, patchPlayer, startedState } from '../test/fakeApi.js';

describe('Properties', () => {
  it('shows the empty state when the player owns nothing', () => {
    const state = startedState();
    const { api } = makeApi(state);
    render(<Properties api={api} player={state.players[0]!} />);
    expect(screen.getByText(t('game.noMonopolies'))).toBeTruthy();
  });

  it('renders a monopoly group header with the house cost', () => {
    const state = patchPlayer(startedState(), 0, { ownedTiles: [1, 3] });
    const { api } = makeApi(state);
    render(<Properties api={api} player={state.players[0]!} />);
    expect(screen.getByText(`₽${HOUSE_COST.BROWN} / дом`)).toBeTruthy();
    expect(screen.getByText(t('tile.marosejka'))).toBeTruthy();
    expect(screen.getByText(t('tile.varvarka'))).toBeTruthy();
  });

  it('dispatches buyHouse for the first tile when building is allowed', () => {
    const state = patchPlayer(startedState(), 0, { ownedTiles: [1, 3], money: 1500 });
    const { api, dispatch } = makeApi(state);
    render(<Properties api={api} player={state.players[0]!} />);
    const addButtons = screen.getAllByRole('button', { name: '+' });
    expect(addButtons[0]!.hasAttribute('disabled')).toBe(false);
    fireEvent.click(addButtons[0]!);
    expect(dispatch).toHaveBeenCalledWith({ type: 'manage/buyHouse', tileIndex: 1 });
  });

  it('dispatches mortgage for an owned, building-free tile', () => {
    const state = patchPlayer(startedState(), 0, { ownedTiles: [1, 3] });
    const { api, dispatch } = makeApi(state);
    render(<Properties api={api} player={state.players[0]!} />);
    const lockButtons = screen.getAllByRole('button', { name: '🔒' });
    fireEvent.click(lockButtons[0]!);
    expect(dispatch).toHaveBeenCalledWith({ type: 'manage/mortgage', tileIndex: 1 });
  });

  it('lists stations and utilities in their own section', () => {
    const state = patchPlayer(startedState(), 0, { ownedTiles: [5] });
    const { api } = makeApi(state);
    render(<Properties api={api} player={state.players[0]!} />);
    expect(screen.getByText('Вокзалы и коммунальные')).toBeTruthy();
    expect(screen.getByText(t('tile.rizhskij'))).toBeTruthy();
  });
});
