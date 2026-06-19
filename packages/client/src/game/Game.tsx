import { useState } from 'react';
import { getToken, playerColor, t } from '@monopoly/core';
import { Board } from '../board/Board.js';
import { Board3D } from '../board3d/Board3D.js';
import { Sidebar } from './Sidebar.js';
import { AuctionModal } from './AuctionModal.js';
import { TradeReviewModal } from './TradeReviewModal.js';
import { OfferReviewModal } from './OfferReviewModal.js';
import { DebtModal } from './DebtModal.js';
import { EventOverlay } from './EventOverlay.js';
import type { GameApi } from './useGame.js';

interface GameProps {
  api: GameApi;
}

export function Game({ api }: GameProps) {
  const viewerId = api.viewerPlayerId;
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const isTradeRecipient = api.state.pendingTrade?.toPlayerId === viewerId;
  // In local hot-seat, viewerId equals current player, so trade review pops naturally.
  // In network mode, only the recipient sees the review modal.
  const showTradeReview = api.mode === 'local'
    ? api.state.pendingTrade !== null
    : isTradeRecipient;

  const isOfferRecipient = api.state.pendingOffer?.toPlayerId === viewerId;
  const showOfferReview = api.mode === 'local'
    ? api.state.pendingOffer !== null
    : isOfferRecipient;

  const currentPlayerId = api.state.players[api.state.currentPlayerIndex]?.id ?? null;

  // The proposer (or, if they're stuck waiting, the current player) sees a
  // "waiting for response" panel with a cancel button, so a proposal a recipient
  // never answers — or one left by a disconnected player — can always be cleared.
  const pendingTrade = api.state.pendingTrade;
  const showTradeWaiting =
    api.mode === 'network' &&
    pendingTrade !== null &&
    !showTradeReview &&
    (pendingTrade.fromPlayerId === viewerId || currentPlayerId === viewerId);

  return (
    <div className="game">
      <div className="game__board">
        <PlayerBar api={api} />
        <button
          type="button"
          className="game__view-toggle"
          onClick={() => setView((v) => (v === '3d' ? '2d' : '3d'))}
        >
          {view === '3d' ? t('game.view2d') : t('game.view3d')}
        </button>
        {view === '3d' ? (
          <Board3D state={api.state} currentPlayerId={currentPlayerId} />
        ) : (
          <Board state={api.state} currentPlayerId={currentPlayerId} />
        )}
      </div>
      <div className="game__sidebar">
        <Sidebar api={api} />
      </div>
      {api.state.pendingAuction && <AuctionModal api={api} />}
      {showTradeReview && <TradeReviewModal api={api} />}
      {showTradeWaiting && pendingTrade && <TradeWaitingModal api={api} toPlayerId={pendingTrade.toPlayerId} />}
      {showOfferReview && <OfferReviewModal api={api} />}
      {api.state.pendingDebt && <DebtModal api={api} />}
      <EventOverlay api={api} />
    </div>
  );
}

/** Always-visible roster in the top-left of the board showing every player's
 *  balance, with the active player highlighted. */
function PlayerBar({ api }: { api: GameApi }) {
  const { state } = api;
  const currentId = state.phase === 'finished' ? null : state.players[state.currentPlayerIndex]?.id;
  const disconnected = new Set(api.disconnectedPlayerIds ?? []);
  return (
    <ul className="player-bar">
      {state.players.map((p) => {
        const token = getToken(p.tokenId);
        const classes = [
          'player-bar__item',
          p.id === currentId && 'player-bar__item--current',
          p.bankrupt && 'player-bar__item--bankrupt',
          disconnected.has(p.id) && 'player-bar__item--offline',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={p.id} className={classes} style={{ borderLeftColor: playerColor(p) }}>
            <span className="player-bar__symbol" style={{ color: playerColor(p) }}>●</span>
            <span className="player-bar__token">{token?.symbol}</span>
            <span className="player-bar__name">
              {p.name}
              {api.mode === 'network' && p.id === api.viewerPlayerId && (
                <span className="player-bar__you"> (вы)</span>
              )}
              {disconnected.has(p.id) && (
                <span className="player-bar__offline"> (отключён)</span>
              )}
            </span>
            <span className="player-bar__money">
              {p.bankrupt ? t('game.bankrupt') : `₽${p.money}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function TradeWaitingModal({ api, toPlayerId }: { api: GameApi; toPlayerId: string }) {
  const to = api.state.players.find((p) => p.id === toPlayerId);
  const name = to ? `${getToken(to.tokenId)?.symbol ?? ''} ${to.name}`.trim() : toPlayerId;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">{t('game.tradeTitle')}</h2>
        <p>{t('game.tradeWaiting', { name })}</p>
        <div className="modal__buttons">
          <button
            type="button"
            className="sidebar__action sidebar__action--decline"
            onClick={() => api.dispatch({ type: 'trade/cancel' })}
          >
            {t('game.tradeCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

