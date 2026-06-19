import { t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TradeReviewModal } from './TradeReviewModal.js';
import { makeApi, startedState } from '../test/fakeApi.js';

function tradeState() {
  const st = startedState();
  return {
    ...st,
    pendingTrade: {
      fromPlayerId: st.players[0]!.id,
      toPlayerId: st.players[1]!.id,
      fromOffer: { tiles: [1], money: 50, jailFreeCards: 0 },
      toOffer: { tiles: [], money: 0, jailFreeCards: 1 },
    },
  };
}

describe('TradeReviewModal', () => {
  it('renders nothing without a pending trade', () => {
    const { api } = makeApi(startedState());
    const { container } = render(<TradeReviewModal api={api} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows both offer bundles', () => {
    const { api } = makeApi(tradeState());
    render(<TradeReviewModal api={api} />);
    expect(screen.getByText(t('game.tradeTitle'))).toBeTruthy();
    expect(screen.getByText('Алиса отдаёт')).toBeTruthy();
    expect(screen.getByText('Боб отдаёт')).toBeTruthy();
    expect(screen.getByText(t('tile.marosejka'))).toBeTruthy();
    expect(screen.getByText('₽50')).toBeTruthy();
    expect(screen.getByText('🎟️ × 1')).toBeTruthy();
  });

  it('dispatches accept and decline', () => {
    const { api, dispatch } = makeApi(tradeState());
    render(<TradeReviewModal api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.tradeAccept') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'trade/accept' });
    fireEvent.click(screen.getByRole('button', { name: t('game.tradeDecline') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'trade/decline' });
  });
});
