import { t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TradeModal } from './TradeModal.js';
import { makeApi, patchPlayer, startedState } from '../test/fakeApi.js';

describe('TradeModal', () => {
  it('proposes a trade with the selected tile and the chosen partner', () => {
    const state = patchPlayer(startedState(), 0, { ownedTiles: [1] });
    const { api, dispatch } = makeApi(state);
    const onClose = vi.fn();
    render(<TradeModal api={api} viewer={state.players[0]!} onClose={onClose} />);

    // Tick the only ownable tile on the "you give" side.
    fireEvent.click(screen.getByLabelText(t('tile.marosejka')));
    fireEvent.click(screen.getByRole('button', { name: t('game.tradePropose') }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'trade/propose',
      fromPlayerId: state.players[0]!.id,
      toPlayerId: state.players[1]!.id,
      fromOffer: { tiles: [1], money: 0, jailFreeCards: 0 },
      toOffer: { tiles: [], money: 0, jailFreeCards: 0 },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels without dispatching', () => {
    const state = startedState();
    const { api, dispatch } = makeApi(state);
    const onClose = vi.fn();
    render(<TradeModal api={api} viewer={state.players[0]!} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.cancel') }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the no-partners state when everyone else is bankrupt', () => {
    const state = patchPlayer(startedState(), 1, { bankrupt: true });
    const { api } = makeApi(state);
    render(<TradeModal api={api} viewer={state.players[0]!} onClose={() => {}} />);
    expect(screen.getByText('Нет доступных партнёров')).toBeTruthy();
  });
});
