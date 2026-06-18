import { useState } from 'react';
import { t } from '@monopoly/core';
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

  return (
    <div className="game">
      <div className="game__board">
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
      {showOfferReview && <OfferReviewModal api={api} />}
      {api.state.pendingDebt && <DebtModal api={api} />}
      <EventOverlay api={api} />
    </div>
  );
}

