import { useMemo, useState } from 'react';
import {
  getTile,
  getToken,
  t,
  TileKind,
  type Player,
  type TileIndex,
  type TradeBundle,
} from '@monopoly/core';
import type { GameApi } from './useGame.js';

interface TradeModalProps {
  api: GameApi;
  viewer: Player;
  onClose: () => void;
}

export function TradeModal({ api, viewer, onClose }: TradeModalProps) {
  const state = api.state;
  const others = useMemo(
    () => state.players.filter((p) => !p.bankrupt && p.id !== viewer.id),
    [state.players, viewer.id],
  );
  const [partnerId, setPartnerId] = useState(others[0]?.id ?? '');
  const [fromTiles, setFromTiles] = useState<readonly TileIndex[]>([]);
  const [toTiles, setToTiles] = useState<readonly TileIndex[]>([]);
  const [fromMoney, setFromMoney] = useState(0);
  const [toMoney, setToMoney] = useState(0);
  const [fromCards, setFromCards] = useState(0);
  const [toCards, setToCards] = useState(0);

  const partner = state.players.find((p) => p.id === partnerId);

  if (!partner) {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2 className="modal__title">{t('game.tradeTitle')}</h2>
          <p>Нет доступных партнёров</p>
          <button type="button" className="sidebar__action" onClick={onClose}>
            {t('game.cancel')}
          </button>
        </div>
      </div>
    );
  }

  const toggleFromTile = (idx: TileIndex) =>
    setFromTiles((cur) => (cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx]));
  const toggleToTile = (idx: TileIndex) =>
    setToTiles((cur) => (cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx]));

  const propose = () => {
    const fromOffer: TradeBundle = {
      tiles: fromTiles,
      money: fromMoney,
      jailFreeCards: fromCards,
    };
    const toOffer: TradeBundle = {
      tiles: toTiles,
      money: toMoney,
      jailFreeCards: toCards,
    };
    api.dispatch({
      type: 'trade/propose',
      fromPlayerId: viewer.id,
      toPlayerId: partner.id,
      fromOffer,
      toOffer,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <h2 className="modal__title">{t('game.tradeTitle')}</h2>
        <label className="modal__row">
          <span>{t('game.tradeWith')}:</span>
          <select
            className="modal__select"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {getToken(p.tokenId)?.symbol} {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="trade-grid">
          <Side
            label={t('game.tradeYouGive')}
            player={viewer}
            tiles={fromTiles}
            money={fromMoney}
            cards={fromCards}
            onToggleTile={toggleFromTile}
            onChangeMoney={setFromMoney}
            onChangeCards={setFromCards}
          />
          <Side
            label={t('game.tradeYouReceive')}
            player={partner}
            tiles={toTiles}
            money={toMoney}
            cards={toCards}
            onToggleTile={toggleToTile}
            onChangeMoney={setToMoney}
            onChangeCards={setToCards}
          />
        </div>

        <div className="modal__buttons">
          <button type="button" className="sidebar__action" onClick={propose}>
            {t('game.tradePropose')}
          </button>
          <button type="button" className="sidebar__action sidebar__action--decline" onClick={onClose}>
            {t('game.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SideProps {
  label: string;
  player: Player;
  tiles: readonly TileIndex[];
  money: number;
  cards: number;
  onToggleTile: (idx: TileIndex) => void;
  onChangeMoney: (n: number) => void;
  onChangeCards: (n: number) => void;
}

function Side({ label, player, tiles, money, cards, onToggleTile, onChangeMoney, onChangeCards }: SideProps) {
  return (
    <div className="trade-side">
      <h3 className="trade-side__title">
        {label}: {getToken(player.tokenId)?.symbol} {player.name}
      </h3>
      <ul className="trade-side__tiles">
        {player.ownedTiles.map((idx) => {
          const tile = getTile(idx);
          const checked = tiles.includes(idx);
          return (
            <li key={idx}>
              <label className="trade-side__tile">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleTile(idx)}
                />
                <span>{t(tile.nameKey)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <label className="modal__row">
        <span>₽:</span>
        <input
          type="number"
          className="modal__input"
          value={money}
          min={0}
          max={player.money}
          step={10}
          onChange={(e) => onChangeMoney(Math.max(0, Math.min(player.money, Number(e.target.value))))}
        />
      </label>
      <label className="modal__row">
        <span>🎟️ карт:</span>
        <input
          type="number"
          className="modal__input"
          value={cards}
          min={0}
          max={player.jailFreeCards}
          step={1}
          onChange={(e) => onChangeCards(Math.max(0, Math.min(player.jailFreeCards, Number(e.target.value))))}
        />
      </label>
    </div>
  );
}

void TileKind;
