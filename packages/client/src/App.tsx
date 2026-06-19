import { useState } from 'react';
import { useGame } from './game/useGame.js';
import { useNetworkGame, type NetworkApi } from './game/useNetworkGame.js';
import { Lobby } from './lobby/Lobby.js';
import { NetworkLobby } from './lobby/NetworkLobby.js';
import { Game } from './game/Game.js';
import type { GameApi } from './game/useGame.js';

type Mode = 'menu' | 'local' | 'network';

const WS_URL = computeWsUrl();

function computeWsUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost:8787';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export function App() {
  const [mode, setMode] = useState<Mode>('menu');
  return (
    <div className="app">
      <header className="app__header">
        <h1>Монополия</h1>
        <p className="app__subtitle">
          {mode === 'menu' && 'Выберите режим'}
          {mode === 'local' && 'Локальная игра'}
          {mode === 'network' && 'Сетевая игра'}
        </p>
        {mode !== 'menu' && (
          <button
            type="button"
            className="app__back"
            onClick={() => setMode('menu')}
            title="Назад в меню"
          >
            ← В меню
          </button>
        )}
      </header>
      <main className="app__main">
        {mode === 'menu' && <ModeSelect onPick={setMode} />}
        {mode === 'local' && <LocalShell />}
        {mode === 'network' && <NetworkShell />}
      </main>
    </div>
  );
}

function ModeSelect({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="mode-select">
      <button type="button" className="mode-select__btn" onClick={() => onPick('local')}>
        <div className="mode-select__title">🎲 Локально</div>
        <div className="mode-select__desc">Все игроки за одним экраном (hot-seat)</div>
      </button>
      <button type="button" className="mode-select__btn" onClick={() => onPick('network')}>
        <div className="mode-select__title">🌐 По сети</div>
        <div className="mode-select__desc">Игроки подключаются через WebSocket-комнату</div>
      </button>
    </div>
  );
}

function LocalShell() {
  const game = useGame();
  return game.state.phase === 'lobby' ? <Lobby api={game} /> : <Game api={game} />;
}

function NetworkShell() {
  const net = useNetworkGame(WS_URL);
  if (net.roomId === null || net.state.phase === 'lobby') {
    return <NetworkLobby api={net} />;
  }
  const api: GameApi = networkToGameApi(net);
  return <Game api={api} />;
}

function networkToGameApi(net: NetworkApi): GameApi {
  return {
    state: net.state,
    dispatch: net.dispatch,
    viewerPlayerId: net.yourPlayerId,
    isViewerControlling: true,
    mode: 'network',
    disconnectedPlayerIds: net.disconnectedPlayerIds,
  };
}
