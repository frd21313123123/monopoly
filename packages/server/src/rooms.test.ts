import type { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createRoom,
  findRoomBySocket,
  getRoom,
  listRooms,
  removeClient,
} from './rooms.js';

/** A minimal stand-in for a ws socket — rooms only use it as a Map key. */
function fakeSocket(): WebSocket {
  return {} as WebSocket;
}

describe('createRoom / getRoom', () => {
  it('creates a room with a 5-char id, lobby state, and no clients', () => {
    const room = createRoom(123);
    expect(room.id).toMatch(/^[A-Z0-9]{5}$/);
    expect(room.clients.size).toBe(0);
    expect(room.state.phase).toBe('lobby');
    expect(getRoom(room.id)).toBe(room);
  });

  it('generates unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(createRoom().id);
    expect(ids.size).toBe(50);
  });

  it('seeds the rng state when a seed is given', () => {
    expect(createRoom(777).state.rngState).toBe(777);
  });

  it('getRoom returns undefined for an unknown id', () => {
    expect(getRoom('ZZZZZ')).toBeUndefined();
  });
});

describe('findRoomBySocket', () => {
  it('finds the room a socket belongs to', () => {
    const room = createRoom();
    const ws = fakeSocket();
    room.clients.set(ws, 'p1');
    expect(findRoomBySocket(ws)).toBe(room);
  });

  it('returns undefined for an unknown socket', () => {
    expect(findRoomBySocket(fakeSocket())).toBeUndefined();
  });
});

describe('removeClient', () => {
  it('removes a client and returns the room + playerId', () => {
    const room = createRoom();
    const ws = fakeSocket();
    const other = fakeSocket();
    room.clients.set(ws, 'p1');
    room.clients.set(other, 'p2');

    const removed = removeClient(ws);
    expect(removed).toEqual({ room, playerId: 'p1' });
    expect(room.clients.has(ws)).toBe(false);
    // Room still has another client, so it survives.
    expect(getRoom(room.id)).toBe(room);
  });

  it('deletes the room when the last client leaves', () => {
    const room = createRoom();
    const ws = fakeSocket();
    room.clients.set(ws, 'solo');
    removeClient(ws);
    expect(getRoom(room.id)).toBeUndefined();
  });

  it('returns null for a socket in no room', () => {
    expect(removeClient(fakeSocket())).toBeNull();
  });
});

describe('applyAction', () => {
  it('reduces the room state and stores the result', () => {
    const room = createRoom(1);
    const next = applyAction(room, { type: 'lobby/addPlayer', name: 'A', tokenId: 'hat' });
    expect(next).toBe(room.state);
    expect(room.state.players).toHaveLength(1);
    expect(room.state.players[0]!.name).toBe('A');
  });

  it('keeps the state object identical when the reducer rejects the action', () => {
    const room = createRoom(1);
    const before = room.state;
    // startGame with no players is rejected by the reducer.
    applyAction(room, { type: 'lobby/startGame' });
    expect(room.state).toBe(before);
  });
});

describe('listRooms', () => {
  it('includes newly created rooms', () => {
    const before = listRooms().length;
    const a = createRoom();
    const b = createRoom();
    const after = listRooms();
    expect(after.length).toBe(before + 2);
    expect(after).toContain(a);
    expect(after).toContain(b);
  });
});
