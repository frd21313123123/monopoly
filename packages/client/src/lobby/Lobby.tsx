import { useMemo, useState } from 'react';
import { getToken, MIN_PLAYERS, t } from '@monopoly/core';
import type { GameApi } from '../game/useGame.js';
import { TokenPicker } from './TokenPicker.js';

interface LobbyProps {
  api: GameApi;
}

export function Lobby({ api }: LobbyProps) {
  const [name, setName] = useState('');
  const [tokenId, setTokenId] = useState<string | null>(null);

  const takenTokens = useMemo(
    () => new Set(api.state.players.map((p) => p.tokenId)),
    [api.state.players],
  );

  const canAdd = name.trim().length > 0 && tokenId !== null && !takenTokens.has(tokenId);
  const canStart = api.state.players.length >= MIN_PLAYERS;

  const handleAdd = () => {
    if (!canAdd || !tokenId) return;
    api.dispatch({ type: 'lobby/addPlayer', name: name.trim(), tokenId });
    setName('');
    setTokenId(null);
  };

  return (
    <div className="lobby">
      <section className="lobby__form">
        <label className="lobby__label">
          {t('lobby.playerName')}
          <input
            className="lobby__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
            maxLength={20}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canAdd) handleAdd();
            }}
          />
        </label>

        <div className="lobby__token-section">
          <div className="lobby__sublabel">{t('lobby.pickToken')}</div>
          <TokenPicker selected={tokenId} taken={takenTokens} onSelect={setTokenId} />
        </div>

        <button
          type="button"
          className="lobby__add"
          onClick={handleAdd}
          disabled={!canAdd}
        >
          {t('lobby.add')}
        </button>
      </section>

      <section className="lobby__players">
        <h2 className="lobby__heading">Игроки ({api.state.players.length})</h2>
        {api.state.players.length === 0 && (
          <p className="lobby__empty">Пока никого нет</p>
        )}
        <ul className="lobby__list">
          {api.state.players.map((p) => {
            const token = getToken(p.tokenId);
            return (
              <li key={p.id} className="lobby__player" style={{ borderLeftColor: token?.color }}>
                <span className="lobby__player-symbol">{token?.symbol}</span>
                <span className="lobby__player-name">{p.name}</span>
                <button
                  type="button"
                  className="lobby__player-remove"
                  onClick={() => api.dispatch({ type: 'lobby/removePlayer', playerId: p.id })}
                  aria-label={t('lobby.remove')}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="lobby__start"
          disabled={!canStart}
          onClick={() => api.dispatch({ type: 'lobby/startGame' })}
        >
          {t('lobby.start')}
        </button>
        {!canStart && <p className="lobby__hint">{t('lobby.minPlayers')}</p>}
      </section>
    </div>
  );
}
