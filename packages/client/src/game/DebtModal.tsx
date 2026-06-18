import { t, type Player } from '@monopoly/core';
import type { GameApi } from './useGame.js';
import { Properties } from './Properties.js';

interface DebtModalProps {
  api: GameApi;
}

/**
 * Shown when the current player can't cover a payment. Instead of bankrupting
 * instantly, the debtor can sell houses / mortgage property here to raise money,
 * then pay off the debt — or explicitly declare bankruptcy.
 */
export function DebtModal({ api }: DebtModalProps) {
  const debt = api.state.pendingDebt;
  if (!debt) return null;
  const debtor = api.state.players.find((p) => p.id === debt.debtorId);
  if (!debtor) return null;

  // The debt modal belongs to the debtor only — never pop it on anyone else's
  // screen. In local hot-seat the viewer is the current player (the debtor), so
  // this passes; in network mode only the debtor's client renders it.
  const isDebtor = api.mode === 'local' || api.viewerPlayerId === debt.debtorId;
  if (!isDebtor) return null;

  const creditorName = debt.creditorId
    ? api.state.players.find((p) => p.id === debt.creditorId)?.name ?? '—'
    : t('game.debtToBank');
  const canPay = debtor.money >= debt.amount;
  const shortfall = Math.max(0, debt.amount - debtor.money);

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <h2 className="modal__title">{t('game.debtTitle')}</h2>
        <div className="modal__active">
          {t('game.debtOwe', { amount: debt.amount, creditor: creditorName })}
        </div>
        <p className="debt__hint">{t('game.debtRaise')}</p>
        <p className="debt__money">{t('game.debtHave', { money: debtor.money })}</p>

        <DebtProperties api={api} player={debtor} />

        <div className="modal__buttons">
          <button
            type="button"
            className="sidebar__action"
            disabled={!canPay}
            onClick={() => api.dispatch({ type: 'debt/pay' })}
          >
            {canPay
              ? t('game.debtPay', { amount: debt.amount })
              : t('game.debtNeedMore', { amount: shortfall })}
          </button>
          <button
            type="button"
            className="sidebar__action sidebar__action--decline"
            onClick={() => api.dispatch({ type: 'debt/declareBankruptcy' })}
          >
            {t('game.debtBankrupt')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The debtor's holdings with the standard sell / mortgage controls. */
function DebtProperties({ api, player }: { api: GameApi; player: Player }) {
  if (player.ownedTiles.length === 0) {
    return <p className="sidebar__empty">{t('game.noMonopolies')}</p>;
  }
  return (
    <div className="debt__properties">
      <Properties api={api} player={player} />
    </div>
  );
}
