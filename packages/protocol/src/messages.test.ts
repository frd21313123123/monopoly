import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  isClientMsg,
  isServerMsg,
  type ClientMsg,
  type ServerMsg,
} from './messages.js';

describe('PROTOCOL_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
  });
});

describe('isClientMsg', () => {
  const valid: ClientMsg[] = [
    { type: 'createRoom', hostName: 'A', hostTokenId: 'hat' },
    { type: 'joinRoom', roomId: 'ABCDE', playerName: 'B', tokenId: 'car' },
    { type: 'submitAction', action: { type: 'turn/rollAndMove' } },
    { type: 'leaveRoom' },
  ];

  it.each(valid)('accepts $type', (msg) => {
    expect(isClientMsg(msg)).toBe(true);
  });

  it('rejects server messages', () => {
    expect(isClientMsg({ type: 'stateUpdate' })).toBe(false);
  });

  it('rejects unknown / malformed values', () => {
    expect(isClientMsg(null)).toBe(false);
    expect(isClientMsg(undefined)).toBe(false);
    expect(isClientMsg('createRoom')).toBe(false);
    expect(isClientMsg(42)).toBe(false);
    expect(isClientMsg({})).toBe(false);
    expect(isClientMsg({ type: 'nope' })).toBe(false);
  });
});

describe('isServerMsg', () => {
  const valid: ServerMsg[] = [
    { type: 'roomCreated', roomId: 'X', yourPlayerId: 'p', state: {} as never },
    { type: 'roomJoined', roomId: 'X', yourPlayerId: 'p', state: {} as never },
    { type: 'stateUpdate', state: {} as never },
    { type: 'error', code: 'BAD_REQUEST', message: 'm' },
    { type: 'playerDisconnected', playerId: 'p' },
  ];

  it.each(valid)('accepts $type', (msg) => {
    expect(isServerMsg(msg)).toBe(true);
  });

  it('rejects client messages', () => {
    expect(isServerMsg({ type: 'createRoom' })).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(isServerMsg(null)).toBe(false);
    expect(isServerMsg([])).toBe(false);
    expect(isServerMsg({ type: 123 })).toBe(false);
  });
});
