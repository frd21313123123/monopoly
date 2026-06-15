import { useState } from 'react';
import {
  getTile,
  getToken,
  MIN_BID_INCREMENT,
  t,
  type GameState,
} from '@monopoly/core';
import type { GameApi } from './useGame.js';

interface AuctionModalProps {
  api: GameApi;
}

export function AuctionModal({ api }: AuctionModalProps) {
  const auction = api.state.pendingAuction;
  const [bidInput, setBidInput] = useState<number | null>(null);
  if (!auction) return null;
  const tile = getTile(auction.tileIndex);
  const turnPlayerId = auction.activePlayerIds[auction.turnIndex];
  const turnPlayer = api.state.players.find((p) => p.id === turnPlayerId);
  const highBidder = auction.highBidderId
    ? api.state.players.find((p) => p.id === auction.highBidderId)
    : null;
  const minBid = auction.currentBid + MIN_BID_INCREMENT;
  const value = bidInput ?? minBid;
  // In hot-seat, the viewer always acts as the current auction player.
  // In network mode, only the active player sees the controls.
  const canAct =
    api.mode === 'local' || (turnPlayer !== undefined && api.viewerPlayerId === turnPlayer.id);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">{t('game.auctionFor', { tile: tile.nameKey })}</h2>
        <div className="modal__row">
          <span>{t('game.auctionCurrent', {
            amount: auction.currentBid,
            bidder: highBidder?.name ?? '—',
          })}</span>
        </div>
        <div className="modal__row modal__active">
          {turnPlayer ? (
            <>
              <span>
                {getToken(turnPlayer.tokenId)?.symbol} <strong>{turnPlayer.name}</strong> — {t('game.auctionYourTurn')}
              </span>
            </>
          ) : (
            <span>Ожидание…</span>
          )}
        </div>
        {turnPlayer && canAct && (
          <>
            <div className="modal__row">
              <span>{t('game.auctionMinBid', { amount: minBid })}</span>
              <input
                type="number"
                className="modal__input"
                value={value}
                min={minBid}
                max={turnPlayer.money}
                step={MIN_BID_INCREMENT}
                onChange={(e) => setBidInput(Number(e.target.value))}
              />
            </div>
            <div className="modal__buttons">
              <button
                type="button"
                className="sidebar__action"
                disabled={value < minBid || value > turnPlayer.money}
                onClick={() => {
                  api.dispatch({ type: 'auction/bid', playerId: turnPlayer.id, amount: value });
                  setBidInput(null);
                }}
              >
                {t('game.bid', { amount: value })}
              </button>
              <button
                type="button"
                className="sidebar__action sidebar__action--decline"
                onClick={() => {
                  api.dispatch({ type: 'auction/pass', playerId: turnPlayer.id });
                  setBidInput(null);
                }}
              >
                {t('game.pass')}
              </button>
            </div>
          </>
        )}
        {turnPlayer && !canAct && (
          <p className="sidebar__waiting">Ждём ход игрока {turnPlayer.name}…</p>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ = GameState;
