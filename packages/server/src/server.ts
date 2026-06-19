import { nextDistinctColor, reduce } from '@monopoly/core';
import {
  isClientMsg,
  type ClientMsg,
  type ServerError,
  type ServerMsg,
} from '@monopoly/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import { canSubmitAction } from './authorize.js';
import { createRoom, findRoomBySocket, getRoom, removeClient, type Room } from './rooms.js';

/**
 * How often to ping every socket. Idle WebSocket connections are otherwise
 * dropped by proxies (nginx's default `proxy_read_timeout` is 60s) when a
 * player goes a while without acting — after which the client can no longer
 * send anything and appears "frozen" on their turn. The ping keeps the
 * connection warm and lets us reap genuinely dead sockets.
 */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * How long a disconnected player keeps their slot before their turn starts being
 * auto-skipped. They can rejoin the same room code (nick + token are preserved in
 * the room state) at any time, but once this grace elapses the game stops waiting
 * on them so the other players aren't frozen on a turn that can't advance.
 * Read per-disconnect (not cached) and overridable via env so tests can shorten it.
 */
function graceMs(): number {
  return Number(process.env.MONOPOLY_GRACE_MS ?? 30_000);
}

/** Pending reconnect-grace timers, keyed `${roomId}:${playerId}`. */
const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(roomId: string, playerId: string): string {
  return `${roomId}:${playerId}`;
}

function clearRoomTimers(roomId: string): void {
  for (const [key, timer] of graceTimers) {
    if (key.startsWith(`${roomId}:`)) {
      clearTimeout(timer);
      graceTimers.delete(key);
    }
  }
}

export function createServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  // Liveness flag per socket: set true on every pong, cleared before each ping.
  const alive = new Map<WebSocket, boolean>();

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: WebSocket, req) => {
    const addr = req.socket.remoteAddress ?? 'unknown';
    console.log(`[ws] connect ${addr}`);

    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        sendError(ws, 'BAD_REQUEST', 'Invalid JSON');
        return;
      }
      if (!isClientMsg(parsed)) {
        sendError(ws, 'BAD_REQUEST', 'Unknown message type');
        return;
      }
      handleClientMsg(ws, parsed, wss);
    });

    ws.on('close', () => {
      alive.delete(ws);
      const removed = removeClient(ws);
      if (!removed) {
        console.log('[ws] close');
        return;
      }
      const { room, playerId } = removed;
      broadcastToRoom(wss, room, { type: 'playerDisconnected', playerId });
      console.log(`[ws] close — room ${room.id} player ${playerId}`);

      // Last client left: the room is gone, so drop any lingering timers.
      if (!getRoom(room.id)) {
        clearRoomTimers(room.id);
        return;
      }

      // A drop during the lobby just removes the player — there's no turn to
      // preserve and no reconnect token yet, so keep the roster clean.
      if (room.state.phase === 'lobby') {
        const after = reduce(room.state, { type: 'lobby/removePlayer', playerId });
        if (after !== room.state) {
          room.state = after;
          broadcastToRoom(wss, room, { type: 'stateUpdate', state: room.state });
        }
        return;
      }

      // Mid-game: hold the slot open for a grace period; if they don't rejoin,
      // start auto-skipping their turn so the remaining players aren't frozen.
      room.disconnected.add(playerId);
      const key = timerKey(room.id, playerId);
      const existing = graceTimers.get(key);
      if (existing) clearTimeout(existing);
      graceTimers.set(
        key,
        setTimeout(() => {
          graceTimers.delete(key);
          const live = getRoom(room.id);
          if (!live || !live.disconnected.has(playerId)) return;
          live.skippable.add(playerId);
          autoSkip(wss, live);
        }, graceMs()),
      );
    });

    ws.on('error', (err) => {
      console.error('[ws] error', err);
    });
  });

  return wss;
}

/**
 * Resolves a distinct pawn color for a player joining a room: honors their
 * preferred color when free, otherwise hands out the next unused palette shade
 * so no two players in the room blend together.
 */
function distinctColorFor(state: Room['state'], preferred?: string): string {
  const used = state.players
    .map((p) => p.color)
    .filter((c): c is string => typeof c === 'string');
  return nextDistinctColor(used, preferred);
}

function handleClientMsg(ws: WebSocket, msg: ClientMsg, wss: WebSocketServer): void {
  switch (msg.type) {
    case 'createRoom':
      return handleCreate(ws, msg.hostName, msg.hostTokenId, msg.color);
    case 'joinRoom':
      return handleJoin(ws, msg.roomId, msg.playerName, msg.tokenId, msg.color);
    case 'submitAction':
      return handleAction(ws, msg.action, wss);
    case 'rejoinRoom':
      return handleRejoin(ws, msg.roomId, msg.playerId);
    case 'leaveRoom':
      handleLeave(ws, wss);
      return;
  }
}

function handleCreate(ws: WebSocket, hostName: string, hostTokenId: string, color?: string): void {
  if (findRoomBySocket(ws)) {
    sendError(ws, 'BAD_REQUEST', 'Already in a room');
    return;
  }
  const room = createRoom();
  const stateAfterAdd = reduce(room.state, {
    type: 'lobby/addPlayer',
    name: hostName,
    tokenId: hostTokenId,
    color: distinctColorFor(room.state, color),
  });
  if (stateAfterAdd === room.state) {
    sendError(ws, 'BAD_REQUEST', 'Could not add host player');
    return;
  }
  room.state = stateAfterAdd;
  const hostId = room.state.players[room.state.players.length - 1]!.id;
  room.clients.set(ws, hostId);
  send(ws, {
    type: 'roomCreated',
    roomId: room.id,
    yourPlayerId: hostId,
    state: room.state,
  });
  console.log(`[room] created ${room.id} by ${hostName} (${hostId})`);
}

function handleJoin(ws: WebSocket, roomId: string, playerName: string, tokenId: string, color?: string): void {
  const room = getRoom(roomId);
  if (!room) {
    sendError(ws, 'NOT_FOUND', `Room ${roomId} not found`);
    return;
  }
  if (room.state.phase !== 'lobby') {
    sendError(ws, 'GAME_STARTED', 'Game already started');
    return;
  }
  if (room.state.players.some((p) => p.tokenId === tokenId)) {
    sendError(ws, 'TOKEN_TAKEN', 'Token already taken');
    return;
  }
  const stateAfter = reduce(room.state, {
    type: 'lobby/addPlayer',
    name: playerName,
    tokenId,
    color: distinctColorFor(room.state, color),
  });
  if (stateAfter === room.state) {
    sendError(ws, 'BAD_REQUEST', 'Could not add player');
    return;
  }
  room.state = stateAfter;
  const myId = room.state.players[room.state.players.length - 1]!.id;
  room.clients.set(ws, myId);
  send(ws, {
    type: 'roomJoined',
    roomId: room.id,
    yourPlayerId: myId,
    state: room.state,
  });
  broadcastState(room, ws);
  console.log(`[room] ${roomId} join ${playerName} (${myId})`);
}

function handleAction(ws: WebSocket, action: ClientMsg & { type: 'submitAction' } extends { action: infer A } ? A : never, wss: WebSocketServer): void {
  const room = findRoomBySocket(ws);
  if (!room) {
    sendError(ws, 'NOT_FOUND', 'Not in a room');
    return;
  }
  const playerId = room.clients.get(ws);
  if (!playerId) {
    sendError(ws, 'NOT_FOUND', 'Player id missing');
    return;
  }
  if (!canSubmitAction(room.state, playerId, action)) {
    sendError(ws, 'NOT_YOUR_TURN', 'Action not allowed for this player');
    return;
  }
  const before = room.state;
  const after = reduce(room.state, action);
  if (after === before) {
    sendError(ws, 'INVALID_ACTION', 'Action rejected by reducer');
    return;
  }
  room.state = after;
  broadcastToRoom(wss, room, { type: 'stateUpdate', state: room.state });
  // The turn may now rest on a player whose grace already expired — skip past them.
  autoSkip(wss, room);
}

/**
 * Reclaim a player's slot after a reconnect. The room still holds their player
 * (nick/token/state), so we just rebind the new socket, cancel the grace timer
 * and clear the disconnected/skippable flags, then resend the current state.
 */
function handleRejoin(ws: WebSocket, roomId: string, playerId: string): void {
  if (findRoomBySocket(ws)) {
    sendError(ws, 'BAD_REQUEST', 'Already in a room');
    return;
  }
  const room = getRoom(roomId);
  if (!room) {
    sendError(ws, 'NOT_FOUND', `Room ${roomId} not found`);
    return;
  }
  if (!room.state.players.some((p) => p.id === playerId)) {
    sendError(ws, 'NOT_FOUND', 'Player not in room');
    return;
  }
  // Evict any stale/zombie socket still mapped to this player.
  for (const [sock, pid] of room.clients) {
    if (pid === playerId && sock !== ws) room.clients.delete(sock);
  }
  const key = timerKey(room.id, playerId);
  const timer = graceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    graceTimers.delete(key);
  }
  room.disconnected.delete(playerId);
  room.skippable.delete(playerId);
  room.clients.set(ws, playerId);
  send(ws, { type: 'roomJoined', roomId: room.id, yourPlayerId: playerId, state: room.state });
  // Notify the others (not the reclaiming socket — it already got roomJoined).
  for (const sock of room.clients.keys()) {
    if (sock !== ws) send(sock, { type: 'playerReconnected', playerId });
  }
  console.log(`[room] ${room.id} rejoin ${playerId}`);
}

/**
 * Advance the turn past any current player whose reconnect grace has expired.
 * Loops in case several skippable players sit back to back; the guard stops a
 * runaway if every remaining player is gone (the room empties and is reaped
 * separately once all sockets close).
 */
function autoSkip(wss: WebSocketServer, room: Room): void {
  let guard = 0;
  while (room.state.phase === 'playing' && guard <= room.state.players.length) {
    const current = room.state.players[room.state.currentPlayerIndex];
    if (!current || !room.skippable.has(current.id)) break;
    room.state = reduce(room.state, { type: 'turn/skip' });
    broadcastToRoom(wss, room, { type: 'stateUpdate', state: room.state });
    guard++;
  }
}

function handleLeave(ws: WebSocket, wss: WebSocketServer): void {
  const removed = removeClient(ws);
  if (removed) {
    broadcastToRoom(wss, removed.room, {
      type: 'playerDisconnected',
      playerId: removed.playerId,
    });
  }
}

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function sendError(ws: WebSocket, code: ServerError['code'], message: string): void {
  send(ws, { type: 'error', code, message });
}

function broadcastToRoom(_wss: WebSocketServer, room: Room, msg: ServerMsg): void {
  for (const ws of room.clients.keys()) {
    send(ws, msg);
  }
}

function broadcastState(room: Room, except?: WebSocket): void {
  for (const ws of room.clients.keys()) {
    if (ws === except) continue;
    send(ws, { type: 'stateUpdate', state: room.state });
  }
}
