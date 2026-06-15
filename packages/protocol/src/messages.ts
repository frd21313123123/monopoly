import type { Action, GameState } from '@monopoly/core';

/** Protocol version — bump on breaking changes. */
export const PROTOCOL_VERSION = 1;

// ===== Client → Server =====

export interface CreateRoom {
  type: 'createRoom';
  hostName: string;
  hostTokenId: string;
}

export interface JoinRoom {
  type: 'joinRoom';
  roomId: string;
  playerName: string;
  tokenId: string;
}

export interface SubmitAction {
  type: 'submitAction';
  action: Action;
}

export interface LeaveRoom {
  type: 'leaveRoom';
}

export type ClientMsg = CreateRoom | JoinRoom | SubmitAction | LeaveRoom;

// ===== Server → Client =====

export interface RoomCreated {
  type: 'roomCreated';
  roomId: string;
  yourPlayerId: string;
  state: GameState;
}

export interface RoomJoined {
  type: 'roomJoined';
  roomId: string;
  yourPlayerId: string;
  state: GameState;
}

export interface StateUpdate {
  type: 'stateUpdate';
  state: GameState;
}

export interface ServerError {
  type: 'error';
  code: 'NOT_FOUND' | 'INVALID_ACTION' | 'NOT_YOUR_TURN' | 'ROOM_FULL' | 'TOKEN_TAKEN' | 'GAME_STARTED' | 'BAD_REQUEST';
  message: string;
}

export interface PlayerDisconnected {
  type: 'playerDisconnected';
  playerId: string;
}

export type ServerMsg = RoomCreated | RoomJoined | StateUpdate | ServerError | PlayerDisconnected;

// ===== Helpers =====

export function isClientMsg(value: unknown): value is ClientMsg {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { type?: unknown };
  return (
    obj.type === 'createRoom' ||
    obj.type === 'joinRoom' ||
    obj.type === 'submitAction' ||
    obj.type === 'leaveRoom'
  );
}

export function isServerMsg(value: unknown): value is ServerMsg {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { type?: unknown };
  return (
    obj.type === 'roomCreated' ||
    obj.type === 'roomJoined' ||
    obj.type === 'stateUpdate' ||
    obj.type === 'error' ||
    obj.type === 'playerDisconnected'
  );
}
