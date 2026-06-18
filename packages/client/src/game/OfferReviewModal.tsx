import { getToken, getTile, t } from '@monopoly/core';
import type { GameApi } from './useGame.js';

interface OfferReviewProps {
  api: GameApi;
}

/** Shown to the player who was offered the chance to buy the tile the current
 *  player landed on, at a price the current player named. */
export function OfferReviewModal({ api }: OfferReviewProps) {
  const offer = api.state.pendingOffer;
  if (!offer) return null;
  const from = api.state.players.find((p) => p.id === offer.fromPlayerId);
  const to = api.state.players.find((p) => p.id === offer.toPlayerId);
  if (!from || !to) return null;
  const tile = getTile(offer.tileIndex);
  const canAfford = to.money >= offer.price;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">{t('game.offerReviewTitle')}</h2>
        <p>
          {t('game.offerReviewBody', {
            from: `${getToken(from.tokenId)?.symbol ?? ''} ${from.name}`,
            tile: tile.nameKey,
            price: offer.price,
          })}
        </p>
        <p className="sidebar__empty">{t('game.offerReviewBase', { price: offer.originalPrice })}</p>
        <div className="modal__buttons">
          <button
            type="button"
            className="sidebar__action sidebar__action--end"
            disabled={!canAfford}
            onClick={() => api.dispatch({ type: 'offer/accept' })}
          >
            {canAfford ? t('game.offerAccept', { price: offer.price }) : t('game.offerCantAfford')}
          </button>
          <button
            type="button"
            className="sidebar__action sidebar__action--decline"
            onClick={() => api.dispatch({ type: 'offer/decline' })}
          >
            {t('game.offerDecline')}
          </button>
        </div>
      </div>
    </div>
  );
}
