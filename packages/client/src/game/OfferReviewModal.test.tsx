import { t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OfferReviewModal } from './OfferReviewModal.js';
import { makeApi, patchPlayer, startedState } from '../test/fakeApi.js';

function offerState(price: number, toMoney: number) {
  let st = startedState();
  st = patchPlayer(st, 1, { money: toMoney });
  return {
    ...st,
    pendingOffer: {
      tileIndex: 1,
      fromPlayerId: st.players[0]!.id,
      toPlayerId: st.players[1]!.id,
      price,
      originalPrice: 60,
    },
  };
}

describe('OfferReviewModal', () => {
  it('renders nothing without a pending offer', () => {
    const { api } = makeApi(startedState());
    const { container } = render(<OfferReviewModal api={api} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the offer title and base price hint', () => {
    const { api } = makeApi(offerState(100, 500));
    render(<OfferReviewModal api={api} />);
    expect(screen.getByText(t('game.offerReviewTitle'))).toBeTruthy();
    expect(screen.getByText(t('game.offerReviewBase', { price: 60 }))).toBeTruthy();
  });

  it('dispatches offer/accept when affordable', () => {
    const { api, dispatch } = makeApi(offerState(100, 500));
    render(<OfferReviewModal api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.offerAccept', { price: 100 }) }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'offer/accept' });
  });

  it('disables accept when the buyer cannot afford it', () => {
    const { api } = makeApi(offerState(100, 50));
    render(<OfferReviewModal api={api} />);
    const acceptBtn = screen.getByRole('button', { name: t('game.offerCantAfford') });
    expect(acceptBtn.hasAttribute('disabled')).toBe(true);
  });

  it('dispatches offer/decline', () => {
    const { api, dispatch } = makeApi(offerState(100, 500));
    render(<OfferReviewModal api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.offerDecline') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'offer/decline' });
  });
});
