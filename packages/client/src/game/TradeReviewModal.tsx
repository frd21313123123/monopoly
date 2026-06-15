import { getToken, getTile, t } from '@monopoly/core';
import type { GameApi } from './useGame.js';

interface TradeReviewProps {
  api: GameApi;
}

export function TradeReviewModal({ api }: TradeReviewProps) {
  const trade = api.state.pendingTrade;
  if (!trade) return null;
  const from = api.state.players.find((p) => p.id === trade.fromPlayerId);
  const to = api.state.players.find((p) => p.id === trade.toPlayerId);
  if (!from || !to) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <h2 className="modal__title">{t('game.tradeTitle')}</h2>
        <p>
          {getToken(from.tokenId)?.symbol} <strong>{from.name}</strong> → {getToken(to.tokenId)?.symbol}{' '}
          <strong>{to.name}</strong>
        </p>
        <div className="trade-grid">
          <BundleView title={`${from.name} отдаёт`} tiles={trade.fromOffer.tiles} money={trade.fromOffer.money} cards={trade.fromOffer.jailFreeCards} />
          <BundleView title={`${to.name} отдаёт`} tiles={trade.toOffer.tiles} money={trade.toOffer.money} cards={trade.toOffer.jailFreeCards} />
        </div>
        <div className="modal__buttons">
          <button type="button" className="sidebar__action sidebar__action--end" onClick={() => api.dispatch({ type: 'trade/accept' })}>
            {t('game.tradeAccept')}
          </button>
          <button type="button" className="sidebar__action sidebar__action--decline" onClick={() => api.dispatch({ type: 'trade/decline' })}>
            {t('game.tradeDecline')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BundleViewProps {
  title: string;
  tiles: readonly number[];
  money: number;
  cards: number;
}

function BundleView({ title, tiles, money, cards }: BundleViewProps) {
  return (
    <div className="trade-side">
      <h3 className="trade-side__title">{title}</h3>
      <ul className="trade-side__tiles">
        {tiles.length === 0 && <li className="sidebar__empty">—</li>}
        {tiles.map((idx) => (
          <li key={idx}>{t(getTile(idx).nameKey)}</li>
        ))}
      </ul>
      <p>₽{money}</p>
      <p>🎟️ × {cards}</p>
    </div>
  );
}
