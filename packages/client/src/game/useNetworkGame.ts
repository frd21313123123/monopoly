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
  createRoom: (hostName: string, hostTokenId: string) => void;
  joinRoom: (roomId: string, playerName: string, tokenId: string) => void;
  submitAction: (action: Action) => void;
  leaveRoom: () => void;
  dispatch: (action: Action) => void;
}

export function useNetworkGame(wsUrl: string): NetworkApi {
  const [state, setState] = useState<GameState>(() => initialState(0));
  const [status, setStatus] = useState<ConnectionStatus>({ kind: 'disconnected' });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [yourPlayerId, setYourPlayerId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ServerError | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setStatus({ kind: 'connecting' });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus({ kind: 'connected' });
    ws.onerror = () => setStatus({ kind: 'error', reason: 'WebSocket error' });
    ws.onclose = () => {
      setStatus({ kind: 'disconnected' });
      wsRef.current = null;
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

    return () => {
      if (ws.readyState === ws.OPEN) ws.close();
      wsRef.current = null;
    };
  }, [wsUrl]);

  const handleServerMsg = (msg: ServerMsg) => {
    switch (msg.type) {
      case 'roomCreated':
      case 'roomJoined':
        setRoomId(msg.roomId);
        setYourPlayerId(msg.yourPlayerId);
        setState(msg.state);
        setLastError(null);
        return;
      case 'stateUpdate':
        setState(msg.state);
        return;
      case 'error':
        setLastError(msg);
        return;
      case 'playerDisconnected':
        return;
    }
  };

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
    createRoom: (hostName, hostTokenId) => send({ type: 'createRoom', hostName, hostTokenId }),
    joinRoom: (rid, playerName, tokenId) =>
      send({ type: 'joinRoom', roomId: rid, playerName, tokenId }),
    submitAction: (action) => send({ type: 'submitAction', action }),
    leaveRoom: () => {
      send({ type: 'leaveRoom' });
      setRoomId(null);
      setYourPlayerId(null);
    },
    dispatch: (action) => send({ type: 'submitAction', action }),
  };
}
