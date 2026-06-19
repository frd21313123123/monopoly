import { t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DebtModal } from './DebtModal.js';
import { makeApi, patchPlayer, startedState } from '../test/fakeApi.js';

function debtState(amount: number, debtorMoney: number) {
  let st = startedState();
  st = patchPlayer(st, 0, { money: debtorMoney });
  return {
    ...st,
    pendingDebt: {
      debtorId: st.players[0]!.id,
      creditorId: st.players[1]!.id,
      amount,
    },
  };
}

describe('DebtModal', () => {
  it('renders nothing when there is no debt', () => {
    const { api } = makeApi(startedState());
    const { container } = render(<DebtModal api={api} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the owed amount and current money', () => {
    const { api } = makeApi(debtState(300, 120));
    render(<DebtModal api={api} />);
    expect(screen.getByText(t('game.debtTitle'))).toBeTruthy();
    expect(screen.getByText(t('game.debtHave', { money: 120 }))).toBeTruthy();
  });

  it('disables Pay and shows shortfall when the debtor cannot cover it', () => {
    const { api } = makeApi(debtState(300, 120));
    render(<DebtModal api={api} />);
    const payBtn = screen.getByRole('button', { name: t('game.debtNeedMore', { amount: 180 }) });
    expect(payBtn.hasAttribute('disabled')).toBe(true);
  });

  it('enables Pay and dispatches debt/pay when affordable', () => {
    const { api, dispatch } = makeApi(debtState(300, 500));
    render(<DebtModal api={api} />);
    const payBtn = screen.getByRole('button', { name: t('game.debtPay', { amount: 300 }) });
    expect(payBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(payBtn);
    expect(dispatch).toHaveBeenCalledWith({ type: 'debt/pay' });
  });

  it('dispatches declareBankruptcy', () => {
    const { api, dispatch } = makeApi(debtState(300, 0));
    render(<DebtModal api={api} />);
    fireEvent.click(screen.getByRole('button', { name: t('game.debtBankrupt') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'debt/declareBankruptcy' });
  });

  it('does not render for a non-debtor viewer in network mode', () => {
    const state = debtState(300, 120);
    const { api } = makeApi(state, {
      mode: 'network',
      viewerPlayerId: state.players[1]!.id, // creditor, not debtor
    });
    const { container } = render(<DebtModal api={api} />);
    expect(container.firstChild).toBeNull();
  });
});
