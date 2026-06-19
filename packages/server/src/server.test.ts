import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ClientMsg, ServerMsg } from '@monopoly/protocol';
import { createServer } from './server.js';

let port: number;
let wss: ReturnType<typeof createServer>;
const openClients: TestClient[] = [];

/** A test WebSocket client that buffers incoming server messages. */
class TestClient {
  private ws: WebSocket;
  private queue: ServerMsg[] = [];
  private waiters: ((msg: ServerMsg) => void)[] = [];
  private opened: Promise<void>;

  constructor() {
    this.ws = new WebSocket(`ws://localhost:${port}`);
    this.opened = new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMsg;
      const waiter = this.waiters.shift();
      if (waiter) waiter(msg);
      else this.queue.push(msg);
    });
  }

  async ready(): Promise<this> {
    await this.opened;
    return this;
  }

  send(msg: ClientMsg): void {
    this.ws.send(JSON.stringify(msg));
  }

  sendRaw(data: string): void {
    this.ws.send(data);
  }

  /** Resolves with the next message (buffered or future). */
  next(timeoutMs = 1000): Promise<ServerMsg> {
    const buffered = this.queue.shift();
    if (buffered) return Promise.resolve(buffered);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
      this.waiters.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  close(): void {
    this.ws.close();
  }
}

async function connect(): Promise<TestClient> {
  const c = new TestClient();
  openClients.push(c);
  return c.ready();
}

beforeAll(async () => {
  wss = createServer(0);
  await new Promise<void>((resolve) => wss.once('listening', resolve));
  port = (wss.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

afterEach(() => {
  for (const c of openClients) c.close();
  openClients.length = 0;
});

describe('createRoom', () => {
  it('creates a room and returns roomCreated with the host as the only player', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Алиса', hostTokenId: 'hat' });
    const msg = await host.next();
    expect(msg.type).toBe('roomCreated');
    if (msg.type !== 'roomCreated') throw new Error('unexpected');
    expect(msg.roomId).toMatch(/^[A-Z0-9]{5}$/);
    expect(msg.state.players).toHaveLength(1);
    expect(msg.state.players[0]!.id).toBe(msg.yourPlayerId);
    expect(msg.state.players[0]!.name).toBe('Алиса');
  });

  it('rejects a second createRoom on the same socket', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'A', hostTokenId: 'hat' });
    await host.next(); // roomCreated
    host.send({ type: 'createRoom', hostName: 'A', hostTokenId: 'car' });
    const err = await host.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('BAD_REQUEST');
  });
});

describe('joinRoom', () => {
  it('lets a second player join and broadcasts the update to the host', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    const created = await host.next();
    if (created.type !== 'roomCreated') throw new Error('unexpected');

    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'Guest', tokenId: 'car' });

    const joined = await guest.next();
    expect(joined.type).toBe('roomJoined');
    if (joined.type !== 'roomJoined') throw new Error('unexpected');
    expect(joined.state.players).toHaveLength(2);

    // Host receives a broadcast stateUpdate.
    const hostUpdate = await host.next();
    expect(hostUpdate.type).toBe('stateUpdate');
    if (hostUpdate.type === 'stateUpdate') {
      expect(hostUpdate.state.players).toHaveLength(2);
    }
  });

  it('returns NOT_FOUND for an unknown room', async () => {
    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: 'ZZZZZ', playerName: 'G', tokenId: 'car' });
    const err = await guest.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('NOT_FOUND');
  });

  it('returns TOKEN_TAKEN when the token is in use', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    const created = await host.next();
    if (created.type !== 'roomCreated') throw new Error('unexpected');

    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'G', tokenId: 'hat' });
    const err = await guest.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('TOKEN_TAKEN');
  });

  it('returns GAME_STARTED when the game is already running', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    const created = await host.next();
    if (created.type !== 'roomCreated') throw new Error('unexpected');

    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'G', tokenId: 'car' });
    await guest.next(); // roomJoined
    await host.next(); // broadcast

    host.send({ type: 'submitAction', action: { type: 'lobby/startGame' } });
    await host.next(); // stateUpdate (started)
    await guest.next(); // stateUpdate

    const late = await connect();
    late.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'L', tokenId: 'dog' });
    const err = await late.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('GAME_STARTED');
  });
});

describe('submitAction', () => {
  it('broadcasts state when the host starts the game', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    const created = await host.next();
    if (created.type !== 'roomCreated') throw new Error('unexpected');

    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'G', tokenId: 'car' });
    await guest.next();
    await host.next();

    host.send({ type: 'submitAction', action: { type: 'lobby/startGame' } });
    const update = await host.next();
    expect(update.type).toBe('stateUpdate');
    if (update.type === 'stateUpdate') expect(update.state.phase).toBe('playing');
  });

  it('rejects an action from a player who is not authorized (NOT_YOUR_TURN)', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    const created = await host.next();
    if (created.type !== 'roomCreated') throw new Error('unexpected');

    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'G', tokenId: 'car' });
    await guest.next();
    await host.next();

    // Guest is not the host, so lobby/startGame is not allowed for them.
    guest.send({ type: 'submitAction', action: { type: 'lobby/startGame' } });
    const err = await guest.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects an action the reducer refuses (INVALID_ACTION)', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    await host.next();
    // Only one player: lobby/startGame is rejected by the reducer (needs >= 2).
    host.send({ type: 'submitAction', action: { type: 'lobby/startGame' } });
    const err = await host.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('INVALID_ACTION');
  });

  it('returns NOT_FOUND when submitting without being in a room', async () => {
    const lone = await connect();
    lone.send({ type: 'submitAction', action: { type: 'turn/rollAndMove' } });
    const err = await lone.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('NOT_FOUND');
  });
});

describe('malformed input', () => {
  it('returns BAD_REQUEST for invalid JSON', async () => {
    const c = await connect();
    c.sendRaw('not json');
    const err = await c.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('BAD_REQUEST');
  });

  it('returns BAD_REQUEST for an unknown message type', async () => {
    const c = await connect();
    c.sendRaw(JSON.stringify({ type: 'mystery' }));
    const err = await c.next();
    expect(err.type).toBe('error');
    if (err.type === 'error') expect(err.code).toBe('BAD_REQUEST');
  });
});

describe('disconnect & leave', () => {
  it('broadcasts playerDisconnected to remaining clients when one leaves', async () => {
    const host = await connect();
    host.send({ type: 'createRoom', hostName: 'Host', hostTokenId: 'hat' });
    const created = await host.next();
    if (created.type !== 'roomCreated') throw new Error('unexpected');

    const guest = await connect();
    guest.send({ type: 'joinRoom', roomId: created.roomId, playerName: 'G', tokenId: 'car' });
    const joined = await guest.next();
    if (joined.type !== 'roomJoined') throw new Error('unexpected');
    await host.next(); // host broadcast

    guest.send({ type: 'leaveRoom' });
    const notice = await host.next();
    expect(notice.type).toBe('playerDisconnected');
    if (notice.type === 'playerDisconnected') {
      expect(notice.playerId).toBe(joined.yourPlayerId);
    }
  });
});
