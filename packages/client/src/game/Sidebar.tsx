import { useEffect, useRef, useState } from 'react';
import { getTile, getToken, JAIL_FINE, MAX_JAIL_TURNS, playerColor, t, type DiceRoll, type Player } from '@monopoly/core';
import type { GameApi } from './useGame.js';
import { Properties } from './Properties.js';
import { TradeModal } from './TradeModal.js';
import { playDiceRoll, playTurnStart } from '../audio/sounds.js';

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

  // Pleasant chime when a fresh turn begins — but only when it's *my* turn.
  // (In network mode a friend's turn shouldn't make a sound on my screen.)
  const prevTurnKey = useRef<string | null>(null);
  useEffect(() => {
    if (finished || !current) return;
    const key = `${state.turn}:${state.currentPlayerIndex}`;
    if (prevTurnKey.current === null) {
      prevTurnKey.current = key;
      return;
    }
    if (key !== prevTurnKey.current) {
      prevTurnKey.current = key;
      if (isMyTurn) playTurnStart();
    }
  }, [state.turn, state.currentPlayerIndex, isMyTurn, finished, current]);
  const winner = finished ? state.players.find((p) => !p.bankrupt) : null;
  const [tradeOpen, setTradeOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
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
              canOffer={state.players.some((p) => !p.bankrupt && p.id !== current.id)}
              onBuy={() => dispatch({ type: 'turn/buyCurrent' })}
              onDecline={() => dispatch({ type: 'turn/declinePurchase' })}
              onAuction={() => dispatch({ type: 'turn/auctionCurrent' })}
              onOffer={() => setOfferOpen(true)}
            />
          )}
          {offerOpen && state.pendingPurchase && current && isMyTurn && (
            <OfferModal
              api={api}
              tileIndex={state.pendingPurchase.tileIndex}
              basePrice={state.pendingPurchase.price}
              onClose={() => setOfferOpen(false)}
            />
          )}

          <section className="sidebar__section sidebar__dice">
            <Dice roll={state.lastRoll} rollSeq={state.rollSeq} />
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

      {viewer && viewer.jailFreeCards > 0 && (
        <button
          type="button"
          className="sidebar__action sidebar__action--cards"
          onClick={() => setCardsOpen(true)}
        >
          {t('game.viewCards', { n: viewer.jailFreeCards })}
        </button>
      )}
      {cardsOpen && viewer && <MyCardsModal player={viewer} onClose={() => setCardsOpen(false)} />}

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
  canOffer: boolean;
  onBuy: () => void;
  onDecline: () => void;
  onAuction: () => void;
  onOffer: () => void;
}

function PurchasePrompt({ tileIndex, price, canAfford, canOffer, onBuy, onDecline, onAuction, onOffer }: PurchasePromptProps) {
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
        {canOffer && (
          <button
            type="button"
            className="sidebar__action sidebar__action--trade"
            onClick={onOffer}
          >
            {t('game.offerToPlayer')}
          </button>
        )}
        <button
          type="button"
          className="sidebar__action sidebar__action--auction"
          onClick={onAuction}
        >
          {t('game.auctionStart')}
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

interface OfferModalProps {
  api: GameApi;
  tileIndex: number;
  basePrice: number;
  onClose: () => void;
}

function OfferModal({ api, tileIndex, basePrice, onClose }: OfferModalProps) {
  const current = api.state.players[api.state.currentPlayerIndex];
  const candidates = api.state.players.filter((p) => !p.bankrupt && p.id !== current?.id);
  const [toId, setToId] = useState(candidates[0]?.id ?? '');
  const [price, setPrice] = useState(basePrice);
  const tile = getTile(tileIndex);
  const valid = toId !== '' && Number.isInteger(price) && price > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{t('game.offerTitle')}</h2>
        <p className="sidebar__purchase-tile">{t(tile.nameKey)}</p>
        <label className="offer-form__field">
          <span>{t('game.offerSelectPlayer')}</span>
          <select className="offer-form__control" value={toId} onChange={(e) => setToId(e.target.value)}>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {getToken(p.tokenId)?.symbol} {p.name} — ₽{p.money}
              </option>
            ))}
          </select>
        </label>
        <label className="offer-form__field">
          <span>{t('game.offerPrice')}</span>
          <input
            className="offer-form__control"
            type="number"
            min={1}
            step={10}
            value={price}
            onChange={(e) => setPrice(Math.floor(Number(e.target.value)))}
          />
        </label>
        <div className="modal__buttons">
          <button
            type="button"
            className="sidebar__action sidebar__action--end"
            disabled={!valid}
            onClick={() => {
              api.dispatch({ type: 'turn/offerPurchase', toPlayerId: toId, price });
              onClose();
            }}
          >
            {t('game.offerSend', { price })}
          </button>
          <button type="button" className="sidebar__action sidebar__action--decline" onClick={onClose}>
            {t('game.cancel')}
          </button>
        </div>
      </div>
    </div>
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

const ROLL_MS = 700;

function Dice({ roll, rollSeq }: { roll: DiceRoll | null; rollSeq: number }) {
  const [display, setDisplay] = useState<{ a: number; b: number } | null>(
    roll ? { a: roll.a, b: roll.b } : null,
  );
  const [rolling, setRolling] = useState(false);
  const prevSeq = useRef<number>(rollSeq);

  useEffect(() => {
    if (!roll || rollSeq === prevSeq.current) return;
    prevSeq.current = rollSeq;
    setRolling(true);
    playDiceRoll();
    // Flicker random faces, then settle on the real values.
    const flicker = window.setInterval(() => {
      setDisplay({ a: 1 + Math.floor(Math.random() * 6), b: 1 + Math.floor(Math.random() * 6) });
    }, 80);
    const stop = window.setTimeout(() => {
      window.clearInterval(flicker);
      setDisplay({ a: roll.a, b: roll.b });
      setRolling(false);
    }, ROLL_MS);
    return () => {
      window.clearInterval(flicker);
      window.clearTimeout(stop);
    };
  }, [rollSeq, roll]);

  return (
    <div className="dice">
      <DieFace value={display?.a ?? null} rolling={rolling} />
      <DieFace value={display?.b ?? null} rolling={rolling} />
    </div>
  );
}

// Pip positions on a 3×3 grid (cell indices 0-8, row-major).
const PIP_CELLS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  const cells = value ? new Set(PIP_CELLS[value]) : null;
  return (
    <div
      className={`die${rolling ? ' die--rolling' : ''}`}
      aria-label={value ? `Кубик ${value}` : 'Кубик'}
    >
      {cells ? (
        <span className="die__pips">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="die__cell">
              {cells.has(i) && <span className="die__pip" />}
            </span>
          ))}
        </span>
      ) : (
        '—'
      )}
    </div>
  );
}

function MyCardsModal({ player, onClose }: { player: Player; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{t('game.myCards')}</h2>
        {Array.from({ length: player.jailFreeCards }, (_, i) => (
          <div
            key={i}
            className="card-pop my-card"
            style={{ '--card-color': '#27ae60' } as React.CSSProperties}
          >
            <div className="card-pop__header">🎟️ {t('game.jailFreeCardTitle')}</div>
            <div className="card-pop__body">{t('game.jailFreeCardBody')}</div>
          </div>
        ))}
        <div className="modal__buttons">
          <button type="button" className="sidebar__action" onClick={onClose}>
            {t('game.close')}
          </button>
        </div>
      </div>
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
    <li className={classes} style={{ borderLeftColor: playerColor(player) }}>
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
