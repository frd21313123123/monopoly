import { Board } from '../board/Board.js';
import { Sidebar } from './Sidebar.js';
import { AuctionModal } from './AuctionModal.js';
import { TradeReviewModal } from './TradeReviewModal.js';
import type { GameApi } from './useGame.js';

interface GameProps {
  api: GameApi;
}

export function Game({ api }: GameProps) {
  const viewerId = api.viewerPlayerId;
  const isTradeRecipient = api.state.pendingTrade?.toPlayerId === viewerId;
  // In local hot-seat, viewerId equals current player, so trade review pops naturally.
  // In network mode, only the recipient sees the review modal.
  const showTradeReview = api.mode === 'local'
    ? api.state.pendingTrade !== null
    : isTradeRecipient;

  return (
    <div className="game">
      <div className="game__board">
        <Board state={api.state} currentPlayerId={api.state.players[api.state.currentPlayerIndex]?.id ?? null} />
      </div>
      <div className="game__sidebar">
        <Sidebar api={api} />
      </div>
      {api.state.pendingAuction && <AuctionModal api={api} />}
      {showTradeReview && <TradeReviewModal api={api} />}
    </div>
  );
}

