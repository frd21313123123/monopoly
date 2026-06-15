import { initialState, reduce, type GameState } from '@monopoly/core';
import type { WebSocket } from 'ws';

export interface RoomClient {
  ws: WebSocket;
  playerId: string;
}

export interface Room {
  id: string;
  clients: Map<WebSocket, string>;
  state: GameState;
}

const rooms = new Map<string, Room>();

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genRoomId(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let id = '';
    for (let i = 0; i < 5; i++) {
      id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
    }
    if (!rooms.has(id)) return id;
  }
  throw new Error('Failed to generate unique room id');
}

export function createRoom(seed?: number): Room {
  const id = genRoomId();
  const room: Room = {
    id,
    clients: new Map(),
    state: initialState(seed),
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function removeClient(ws: WebSocket): { room: Room; playerId: string } | null {
  for (const room of rooms.values()) {
    const playerId = room.clients.get(ws);
    if (playerId !== undefined) {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        rooms.delete(room.id);
      }
      return { room, playerId };
    }
  }
  return null;
}

export function findRoomBySocket(ws: WebSocket): Room | undefined {
  for (const room of rooms.values()) {
    if (room.clients.has(ws)) return room;
  }
  return undefined;
}

export function applyAction(room: Room, ...args: Parameters<typeof reduce> extends [GameState, infer A] ? [A] : never): GameState {
  const action = args[0];
  room.state = reduce(room.state, action);
  return room.state;
}

export function listRooms(): readonly Room[] {
  return [...rooms.values()];
}
