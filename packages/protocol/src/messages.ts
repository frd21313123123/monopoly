import type { Action, GameState } from '@monopoly/core';

/** Protocol version — bump on breaking changes. */
export const PROTOCOL_VERSION = 2;

// ===== Client → Server =====

export interface CreateRoom {
  type: 'createRoom';
  hostName: string;
  hostTokenId: string;
  /** Preferred pawn color; the server resolves conflicts to a distinct shade. */
  color?: string;
}

export interface JoinRoom {
  type: 'joinRoom';
  roomId: string;
  playerName: string;
  tokenId: string;
  /** Preferred pawn color; the server resolves conflicts to a distinct shade. */
  color?: string;
}

export interface SubmitAction {
  type: 'submitAction';
  action: Action;
}

export interface LeaveRoom {
  type: 'leaveRoom';
}

/**
 * Reclaim an existing player slot in a room mid-game after a disconnect. The
 * client persists `{roomId, playerId}` from the original join and replays it to
 * resume its turn. The server rebinds the new socket to that player (nick/token
 * are already stored in the room state) as long as the reconnect grace hasn't
 * fully retired the room.
 */
export interface RejoinRoom {
  type: 'rejoinRoom';
  roomId: string;
  playerId: string;
}

export type ClientMsg = CreateRoom | JoinRoom | SubmitAction | LeaveRoom | RejoinRoom;

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

export interface PlayerReconnected {
  type: 'playerReconnected';
  playerId: string;
}

export type ServerMsg =
  | RoomCreated
  | RoomJoined
  | StateUpdate
  | ServerError
  | PlayerDisconnected
  | PlayerReconnected;

// ===== Helpers =====

export function isClientMsg(value: unknown): value is ClientMsg {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { type?: unknown };
  return (
    obj.type === 'createRoom' ||
    obj.type === 'joinRoom' ||
    obj.type === 'submitAction' ||
    obj.type === 'leaveRoom' ||
    obj.type === 'rejoinRoom'
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
    obj.type === 'playerDisconnected' ||
    obj.type === 'playerReconnected'
  );
}
