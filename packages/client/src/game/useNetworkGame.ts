import { useEffect, useRef, useState } from 'react';
import { initialState, type Action, type GameState } from '@monopoly/core';
import {
  isServerMsg,
  type ClientMsg,
  type ServerError,
  type ServerMsg,
} from '@monopoly/protocol';

export type ConnectionStatus =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'error'; reason: string };

export interface NetworkApi {
  state: GameState;
  status: ConnectionStatus;
  roomId: string | null;
  yourPlayerId: string | null;
  lastError: ServerError | null;
  /** Player ids currently shown as disconnected (driven by server broadcasts). */
  disconnectedPlayerIds: readonly string[];
  createRoom: (hostName: string, hostTokenId: string, color?: string) => void;
  joinRoom: (roomId: string, playerName: string, tokenId: string, color?: string) => void;
  submitAction: (action: Action) => void;
  leaveRoom: () => void;
  dispatch: (action: Action) => void;
}

/** Persisted so a dropped client can reclaim its slot on the same room code. */
const SESSION_KEY = 'monopoly.session';

interface Session {
  roomId: string;
  playerId: string;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Session>;
    if (v && typeof v.roomId === 'string' && typeof v.playerId === 'string') {
      return { roomId: v.roomId, playerId: v.playerId };
    }
  } catch {
    /* ignore malformed storage */
  }
  return null;
}

function saveSession(s: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function useNetworkGame(wsUrl: string): NetworkApi {
  const [state, setState] = useState<GameState>(() => initialState(0));
  const [status, setStatus] = useState<ConnectionStatus>({ kind: 'disconnected' });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [yourPlayerId, setYourPlayerId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ServerError | null>(null);
  const [disconnectedPlayerIds, setDisconnectedPlayerIds] = useState<readonly string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<Session | null>(loadSession());
  // True while we've sent a rejoin and are awaiting its reply, so a failing
  // reply (room gone) can be told apart from an ordinary in-game error.
  const rejoinPendingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const handleServerMsg = (msg: ServerMsg) => {
      switch (msg.type) {
        case 'roomCreated':
        case 'roomJoined':
          rejoinPendingRef.current = false;
          setRoomId(msg.roomId);
          setYourPlayerId(msg.yourPlayerId);
          setState(msg.state);
          setLastError(null);
          setDisconnectedPlayerIds([]);
          sessionRef.current = { roomId: msg.roomId, playerId: msg.yourPlayerId };
          saveSession(sessionRef.current);
          return;
        case 'stateUpdate':
          setState(msg.state);
          return;
        case 'error':
          setLastError(msg);
          // A failed rejoin (room reaped / slot gone) ends the session so the
          // UI falls back to the start screen instead of looping forever.
          if (rejoinPendingRef.current) {
            rejoinPendingRef.current = false;
            sessionRef.current = null;
            clearSession();
            setRoomId(null);
            setYourPlayerId(null);
          }
          return;
        case 'playerDisconnected':
          setDisconnectedPlayerIds((ids) =>
            ids.includes(msg.playerId) ? ids : [...ids, msg.playerId],
          );
          return;
        case 'playerReconnected':
          setDisconnectedPlayerIds((ids) => ids.filter((id) => id !== msg.playerId));
          return;
      }
    };

    const scheduleReconnect = () => {
      if (!mounted || reconnectTimer) return;
      const delay = Math.min(1500 + attempts * 500, 5000);
      attempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (!mounted) return;
      setStatus({ kind: 'connecting' });
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        attempts = 0;
        setStatus({ kind: 'connected' });
        // Resume an existing session automatically (network blip or page reload).
        const s = sessionRef.current;
        if (s) {
          rejoinPendingRef.current = true;
          ws.send(JSON.stringify({ type: 'rejoinRoom', roomId: s.roomId, playerId: s.playerId }));
        }
      };
      ws.onerror = () => setStatus({ kind: 'error', reason: 'WebSocket error' });
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setStatus({ kind: 'disconnected' });
        scheduleReconnect();
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!isServerMsg(parsed)) return;
        handleServerMsg(parsed);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && ws.readyState === ws.OPEN) ws.close();
    };
  }, [wsUrl]);

  const send = (msg: ClientMsg) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(msg));
  };

  return {
    state,
    status,
    roomId,
    yourPlayerId,
    lastError,
    disconnectedPlayerIds,
    createRoom: (hostName, hostTokenId, color) =>
      send({ type: 'createRoom', hostName, hostTokenId, ...(color ? { color } : {}) }),
    joinRoom: (rid, playerName, tokenId, color) =>
      send({ type: 'joinRoom', roomId: rid, playerName, tokenId, ...(color ? { color } : {}) }),
    submitAction: (action) => send({ type: 'submitAction', action }),
    leaveRoom: () => {
      send({ type: 'leaveRoom' });
      sessionRef.current = null;
      rejoinPendingRef.current = false;
      clearSession();
      setRoomId(null);
      setYourPlayerId(null);
      setDisconnectedPlayerIds([]);
    },
    dispatch: (action) => send({ type: 'submitAction', action }),
  };
}
