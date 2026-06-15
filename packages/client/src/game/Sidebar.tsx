import { useState } from 'react';
import { getTile, getToken, JAIL_FINE, MAX_JAIL_TURNS, t, type Player } from '@monopoly/core';
import type { GameApi } from './useGame.js';
import { Properties } from './Properties.js';
import { TradeModal } from './TradeModal.js';

interface SidebarProps {
  api: GameApi;
}

export function Sidebar({ api }: SidebarProps) {
  const { state, dispatch } = api;
  const current = state.players[state.currentPlayerIndex];
  const viewer = api.viewerPlayerId
    ? state.players.find((p) => p.id === api.viewerPlayerId)
    : current;
  const isMyTurn = api.mode === 'local' || api.viewerPlayerId === current?.id;
  const finished = state.phase === 'finished';
  const winner = finished ? state.players.find((p) => !p.bankrupt) : null;
  const [tradeOpen, setTradeOpen] = useState(false);
  const canTrade =
    !finished &&
    !state.pendingPurchase &&
    !state.pendingAuction &&
    !state.pendingTrade &&
    viewer &&
    !viewer.bankrupt;

  return (
    <div className="sidebar">
      {finished && (
        <section className="sidebar__section sidebar__finish">
          <h2 className="sidebar__finish-title">{t('game.gameOver')}</h2>
          {winner && (
            <p className="sidebar__finish-winner">
              {t('game.winner', { name: `${getToken(winner.tokenId)?.symbol ?? ''} ${winner.name}` })}
            </p>
          )}
        </section>
      )}

      {!finished && (
        <>
          <section className="sidebar__section">
            <div className="sidebar__turn">
              {t('game.turn')} {state.turn}
            </div>
            {current && (
              <div className="sidebar__current">
                <span>{t('game.currentPlayer')}: </span>
                <strong>
                  {getToken(current.tokenId)?.symbol} {current.name}
                </strong>
              </div>
            )}
          </section>

          {state.pendingPurchase && current && isMyTurn && (
            <PurchasePrompt
              tileIndex={state.pendingPurchase.tileIndex}
              price={state.pendingPurchase.price}
              canAfford={current.money >= state.pendingPurchase.price}
              onBuy={() => dispatch({ type: 'turn/buyCurrent' })}
              onDecline={() => dispatch({ type: 'turn/declinePurchase' })}
            />
          )}

          <section className="sidebar__section sidebar__dice">
            <Dice a={state.lastRoll?.a ?? null} b={state.lastRoll?.b ?? null} />
            {!isMyTurn && (
              <p className="sidebar__waiting">Ход игрока {current?.name}…</p>
            )}
            {isMyTurn && current?.inJail && !state.pendingEndTurn && !state.pendingPurchase && (
              <JailControls
                jailTurns={current.jailTurns}
                canPayFine={current.money >= JAIL_FINE}
                jailFreeCards={current.jailFreeCards}
                onRoll={() => dispatch({ type: 'jail/roll' })}
                onPayFine={() => dispatch({ type: 'jail/payFine' })}
                onUseCard={() => dispatch({ type: 'jail/useCard' })}
              />
            )}
            {isMyTurn && !current?.inJail && !state.pendingPurchase && !state.pendingEndTurn && (
              <button
                type="button"
                className="sidebar__action"
                onClick={() => dispatch({ type: 'turn/rollAndMove' })}
              >
                {state.doublesThisTurn > 0 ? t('game.rollAgain') : t('game.roll')}
              </button>
            )}
            {isMyTurn && !state.pendingPurchase && state.pendingEndTurn && (
              <button
                type="button"
                className="sidebar__action sidebar__action--end"
                onClick={() => dispatch({ type: 'turn/end' })}
              >
                {t('game.endTurn')}
              </button>
            )}
          </section>
        </>
      )}

      {!finished && viewer && !viewer.bankrupt && (
        <Properties api={api} player={viewer} />
      )}

      {canTrade && (
        <button type="button" className="sidebar__action sidebar__action--trade" onClick={() => setTradeOpen(true)}>
          {t('game.openTrade')}
        </button>
      )}
      {tradeOpen && viewer && <TradeModal api={api} viewer={viewer} onClose={() => setTradeOpen(false)} />}

      <section className="sidebar__section">
        <h3 className="sidebar__heading">Игроки</h3>
        <ul className="sidebar__players">
          {state.players.map((p, i) => (
            <PlayerRow key={p.id} player={p} isCurrent={!finished && i === state.currentPlayerIndex} isYou={api.mode === 'network' && p.id === api.viewerPlayerId} />
          ))}
        </ul>
      </section>

      <section className="sidebar__section sidebar__log">
        <h3 className="sidebar__heading">{t('game.log')}</h3>
        <ul className="sidebar__log-list">
          {[...state.log].reverse().slice(0, 12).map((entry, i) => (
            <li key={state.log.length - i} className="sidebar__log-item">
              {t(entry.messageKey, entry.params)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface PurchasePromptProps {
  tileIndex: number;
  price: number;
  canAfford: boolean;
  onBuy: () => void;
  onDecline: () => void;
}

function PurchasePrompt({ tileIndex, price, canAfford, onBuy, onDecline }: PurchasePromptProps) {
  const tile = getTile(tileIndex);
  return (
    <section className="sidebar__section sidebar__purchase">
      <h3 className="sidebar__purchase-title">{t('game.purchaseTitle')}</h3>
      <p className="sidebar__purchase-tile">{t(tile.nameKey)}</p>
      <div className="sidebar__purchase-buttons">
        <button
          type="button"
          className="sidebar__action"
          onClick={onBuy}
          disabled={!canAfford}
        >
          {t('game.buy', { price })}
        </button>
        <button
          type="button"
          className="sidebar__action sidebar__action--decline"
          onClick={onDecline}
        >
          {t('game.decline')}
        </button>
      </div>
    </section>
  );
}

interface JailControlsProps {
  jailTurns: number;
  canPayFine: boolean;
  jailFreeCards: number;
  onRoll: () => void;
  onPayFine: () => void;
  onUseCard: () => void;
}

function JailControls({
  jailTurns,
  canPayFine,
  jailFreeCards,
  onRoll,
  onPayFine,
  onUseCard,
}: JailControlsProps) {
  return (
    <div className="jail-controls">
      <p className="jail-controls__status">
        🔒 {t('game.inJail')} — {t('game.jailAttempt', { n: jailTurns + 1, max: MAX_JAIL_TURNS })}
      </p>
      <button type="button" className="sidebar__action" onClick={onRoll}>
        {t('game.jailRoll')}
      </button>
      <button
        type="button"
        className="sidebar__action sidebar__action--decline"
        onClick={onPayFine}
        disabled={!canPayFine}
      >
        {t('game.jailPayFine')}
      </button>
      {jailFreeCards > 0 && (
        <button type="button" className="sidebar__action" onClick={onUseCard}>
          {t('game.jailUseCard')}
        </button>
      )}
    </div>
  );
}

function Dice({ a, b }: { a: number | null; b: number | null }) {
  return (
    <div className="dice">
      <DieFace value={a} />
      <DieFace value={b} />
    </div>
  );
}

function DieFace({ value }: { value: number | null }) {
  return (
    <div className="die" aria-label={value ? `Кубик ${value}` : 'Кубик'}>
      {value ?? '—'}
    </div>
  );
}

function PlayerRow({ player, isCurrent, isYou }: { player: Player; isCurrent: boolean; isYou?: boolean }) {
  const token = getToken(player.tokenId);
  const classes = [
    'sidebar__player',
    isCurrent && 'sidebar__player--current',
    player.bankrupt && 'sidebar__player--bankrupt',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <li className={classes} style={{ borderLeftColor: token?.color }}>
      <span className="sidebar__player-symbol">{token?.symbol}</span>
      <span className="sidebar__player-name">
        {player.name}
        {isYou && <span className="sidebar__player-you"> (вы)</span>}
        {player.jailFreeCards > 0 && (
          <span className="sidebar__player-jailcard" title="Карта освобождения из тюрьмы">
            {' '}🎟️{player.jailFreeCards > 1 ? `×${player.jailFreeCards}` : ''}
          </span>
        )}
        {player.bankrupt && <span className="sidebar__player-bankrupt"> — {t('game.bankrupt')}</span>}
      </span>
      <span className="sidebar__player-money">₽{player.money}</span>
    </li>
  );
}
