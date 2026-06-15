import { reduce } from '@monopoly/core';
import {
  isClientMsg,
  type ClientMsg,
  type ServerError,
  type ServerMsg,
} from '@monopoly/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import { canSubmitAction } from './authorize.js';
import { createRoom, findRoomBySocket, getRoom, removeClient, type Room } from './rooms.js';

export function createServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket, req) => {
    const addr = req.socket.remoteAddress ?? 'unknown';
    console.log(`[ws] connect ${addr}`);

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
      const removed = removeClient(ws);
      if (removed) {
        broadcastToRoom(wss, removed.room, {
          type: 'playerDisconnected',
          playerId: removed.playerId,
        });
        console.log(`[ws] close — room ${removed.room.id} player ${removed.playerId}`);
      } else {
        console.log('[ws] close');
      }
    });

    ws.on('error', (err) => {
      console.error('[ws] error', err);
    });
  });

  return wss;
}

function handleClientMsg(ws: WebSocket, msg: ClientMsg, wss: WebSocketServer): void {
  switch (msg.type) {
    case 'createRoom':
      return handleCreate(ws, msg.hostName, msg.hostTokenId);
    case 'joinRoom':
      return handleJoin(ws, msg.roomId, msg.playerName, msg.tokenId);
    case 'submitAction':
      return handleAction(ws, msg.action, wss);
    case 'leaveRoom':
      handleLeave(ws, wss);
      return;
  }
}

function handleCreate(ws: WebSocket, hostName: string, hostTokenId: string): void {
  if (findRoomBySocket(ws)) {
    sendError(ws, 'BAD_REQUEST', 'Already in a room');
    return;
  }
  const room = createRoom();
  const stateAfterAdd = reduce(room.state, {
    type: 'lobby/addPlayer',
    name: hostName,
    tokenId: hostTokenId,
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

function handleJoin(ws: WebSocket, roomId: string, playerName: string, tokenId: string): void {
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
