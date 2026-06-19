import { useState } from 'react';
import { MIN_PLAYERS, playerColor, t, TOKENS, type GameState } from '@monopoly/core';
import { ColorPicker, TokenPicker } from './TokenPicker.js';
import type { NetworkApi } from '../game/useNetworkGame.js';

interface NetworkLobbyProps {
  api: NetworkApi;
}

export function NetworkLobby({ api }: NetworkLobbyProps) {
  if (api.roomId === null) {
    return <NetworkStart api={api} />;
  }
  return <NetworkRoomLobby api={api} />;
}

function NetworkStart({ api }: NetworkLobbyProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [joinId, setJoinId] = useState('');

  const canSubmit =
    name.trim().length > 0 &&
    tokenId !== null &&
    (mode === 'create' || joinId.trim().length > 0);

  const submit = () => {
    if (!canSubmit || !tokenId) return;
    const wanted = color ?? undefined;
    if (mode === 'create') {
      api.createRoom(name.trim(), tokenId, wanted);
    } else {
      api.joinRoom(joinId.trim().toUpperCase(), name.trim(), tokenId, wanted);
    }
  };

  return (
    <div className="lobby">
      <section className="lobby__form">
        <div className="net-mode">
          <button
            type="button"
            className={`net-mode__btn ${mode === 'create' ? 'net-mode__btn--active' : ''}`}
            onClick={() => setMode('create')}
          >
            Создать комнату
          </button>
          <button
            type="button"
            className={`net-mode__btn ${mode === 'join' ? 'net-mode__btn--active' : ''}`}
            onClick={() => setMode('join')}
          >
            Подключиться
          </button>
        </div>

        {mode === 'join' && (
          <label className="lobby__label">
            ID комнаты
            <input
              className="lobby__input"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={6}
            />
          </label>
        )}

        <label className="lobby__label">
          {t('lobby.playerName')}
          <input
            className="lobby__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
            maxLength={20}
          />
        </label>

        <div className="lobby__token-section">
          <div className="lobby__sublabel">{t('lobby.pickToken')}</div>
          <TokenPicker selected={tokenId} taken={new Set()} onSelect={setTokenId} />
        </div>

        <div className="lobby__token-section">
          <div className="lobby__sublabel">{t('lobby.pickColor')}</div>
          <ColorPicker selected={color} onSelect={setColor} />
          <p className="lobby__hint">Если цвет занят, сервер подберёт ближайший свободный.</p>
        </div>

        <button type="button" className="lobby__add" onClick={submit} disabled={!canSubmit}>
          {mode === 'create' ? 'Создать' : 'Подключиться'}
        </button>

        {api.lastError && <p className="net-error">{api.lastError.message}</p>}
      </section>

      <section className="lobby__players">
        <h2 className="lobby__heading">Сеть</h2>
        <p className="lobby__hint">
          Статус: <ConnectionLabel status={api.status} />
        </p>
        <p className="lobby__hint">
          {mode === 'create'
            ? 'Создайте комнату и поделитесь её ID с друзьями'
            : 'Введите 5-символьный ID комнаты от организатора'}
        </p>
        <p className="lobby__hint">Фишек доступно: {TOKENS.length}</p>
      </section>
    </div>
  );
}

function NetworkRoomLobby({ api }: NetworkLobbyProps) {
  const state = api.state;
  const isHost = api.yourPlayerId === state.players[0]?.id;
  const canStart = isHost && state.players.length >= MIN_PLAYERS;

  return (
    <div className="lobby">
      <section className="lobby__form">
        <h2 className="lobby__heading">
          Комната: <code className="room-id">{api.roomId}</code>
        </h2>
        <p className="lobby__hint">Поделитесь этим ID с друзьями</p>
        {isHost && (
          <>
            <button
              type="button"
              className="lobby__start"
              disabled={!canStart}
              onClick={() => api.submitAction({ type: 'lobby/startGame' })}
            >
              {t('lobby.start')}
            </button>
            {!canStart && <p className="lobby__hint">{t('lobby.minPlayers')}</p>}
          </>
        )}
        {!isHost && <p className="lobby__hint">Ожидание организатора…</p>}
        <button
          type="button"
          className="sidebar__action sidebar__action--decline"
          onClick={() => api.leaveRoom()}
        >
          Покинуть комнату
        </button>
      </section>

      <section className="lobby__players">
        <h2 className="lobby__heading">Игроки ({state.players.length})</h2>
        <PlayerListNet state={state} myId={api.yourPlayerId} />
      </section>
    </div>
  );
}

function PlayerListNet({ state, myId }: { state: GameState; myId: string | null }) {
  return (
    <ul className="lobby__list">
      {state.players.map((p) => {
        const token = TOKENS.find((tk) => tk.id === p.tokenId);
        return (
          <li
            key={p.id}
            className="lobby__player"
            style={{ borderLeftColor: playerColor(p) }}
          >
            <span className="lobby__player-symbol">{token?.symbol}</span>
            <span className="lobby__player-name">
              {p.name}
              {p.id === myId && <span className="lobby__you"> (вы)</span>}
              {p.id === state.players[0]?.id && <span className="lobby__host"> 👑</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ConnectionLabel({ status }: { status: NetworkApi['status'] }) {
  switch (status.kind) {
    case 'connected':
      return <span style={{ color: '#8aff8a' }}>подключено</span>;
    case 'connecting':
      return <span style={{ color: '#ffb060' }}>подключение…</span>;
    case 'disconnected':
      return <span style={{ color: '#e25555' }}>отключено</span>;
    case 'error':
      return <span style={{ color: '#e25555' }}>ошибка: {status.reason}</span>;
  }
}
