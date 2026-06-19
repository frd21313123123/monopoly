import { t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar.js';
import { makeApi, patchPlayer, startedState } from '../test/fakeApi.js';

describe('Sidebar', () => {
  it('shows the turn, current player, and a roll button', () => {
    const state = startedState();
    const { api, dispatch } = makeApi(state);
    render(<Sidebar api={api} />);
    expect(screen.getByText(`${t('game.turn')} ${state.turn}`)).toBeTruthy();
    const rollBtn = screen.getByRole('button', { name: t('game.roll') });
    fireEvent.click(rollBtn);
    expect(dispatch).toHaveBeenCalledWith({ type: 'turn/rollAndMove' });
  });

  it('shows the end-turn button when the turn is pending', () => {
    const state = { ...startedState(), pendingEndTurn: true };
    const { api, dispatch } = makeApi(state);
    render(<Sidebar api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.endTurn') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'turn/end' });
  });

  it('renders the purchase prompt and wires its buttons', () => {
    const state = { ...startedState(), pendingPurchase: { tileIndex: 1, price: 60 } };
    const { api, dispatch } = makeApi(state);
    render(<Sidebar api={api} />);

    expect(screen.getByText(t('game.purchaseTitle'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('game.buy', { price: 60 }) }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'turn/buyCurrent' });

    fireEvent.click(screen.getByRole('button', { name: t('game.auctionStart') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'turn/auctionCurrent' });

    fireEvent.click(screen.getByRole('button', { name: t('game.decline') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'turn/declinePurchase' });
  });

  it('disables Buy when the player cannot afford the tile', () => {
    let state = startedState();
    state = patchPlayer(state, 0, { money: 10 });
    state = { ...state, pendingPurchase: { tileIndex: 1, price: 60 } };
    const { api } = makeApi(state);
    render(<Sidebar api={api} />);
    expect(
      screen.getByRole('button', { name: t('game.buy', { price: 60 }) }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows jail controls while the current player is jailed', () => {
    const state = patchPlayer(startedState(), 0, { inJail: true, jailTurns: 0, money: 1000 });
    const { api, dispatch } = makeApi(state);
    render(<Sidebar api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.jailPayFine') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'jail/payFine' });
  });

  it('shows the game-over banner with the winner when finished', () => {
    let state = patchPlayer(startedState(), 1, { bankrupt: true });
    state = { ...state, phase: 'finished' };
    const { api } = makeApi(state);
    render(<Sidebar api={api} />);
    expect(screen.getByText(t('game.gameOver'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('game.roll') })).toBeNull();
  });
});
