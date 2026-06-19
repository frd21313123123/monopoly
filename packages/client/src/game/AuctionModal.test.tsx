import { MIN_BID_INCREMENT, t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuctionModal } from './AuctionModal.js';
import { makeApi, patchPlayer, startedState } from '../test/fakeApi.js';

function auctionState(currentBid = 0, turnIndex = 0) {
  const st = patchPlayer(startedState(), 0, { money: 1000 });
  return {
    ...st,
    pendingAuction: {
      tileIndex: 1,
      currentBid,
      highBidderId: null,
      activePlayerIds: st.players.map((p) => p.id),
      turnIndex,
    },
  };
}

describe('AuctionModal', () => {
  it('renders nothing without a pending auction', () => {
    const { api } = makeApi(startedState());
    const { container } = render(<AuctionModal api={api} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the tile name and the current turn player', () => {
    const { api } = makeApi(auctionState());
    render(<AuctionModal api={api} />);
    expect(screen.getByText(t('game.auctionFor', { tile: 'tile.marosejka' }))).toBeTruthy();
    expect(screen.getByText('Алиса')).toBeTruthy();
  });

  it('dispatches a bid at the minimum increment by default', () => {
    const { api, dispatch } = makeApi(auctionState(40));
    render(<AuctionModal api={api} />);
    const minBid = 40 + MIN_BID_INCREMENT;
    fireEvent.click(screen.getByRole('button', { name: t('game.bid', { amount: minBid }) }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'auction/bid',
      playerId: api.state.players[0]!.id,
      amount: minBid,
    });
  });

  it('dispatches a pass', () => {
    const { api, dispatch } = makeApi(auctionState());
    render(<AuctionModal api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.pass') }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'auction/pass',
      playerId: api.state.players[0]!.id,
    });
  });

  it('hides controls and shows a waiting line for a non-active viewer (network)', () => {
    const state = auctionState(0, 0); // Алиса's turn
    const { api } = makeApi(state, {
      mode: 'network',
      viewerPlayerId: state.players[1]!.id, // Боб is watching
    });
    render(<AuctionModal api={api} />);
    expect(screen.queryByRole('button', { name: t('game.pass') })).toBeNull();
    expect(screen.getByText(/Ждём ход игрока/)).toBeTruthy();
  });
});
