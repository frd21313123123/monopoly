import { BOARD_SIZE, getTile, JAIL_INDEX, STATION_INDICES, UTILITY_INDICES } from './board.js';
import { getBuildingLevel } from './buildings.js';
import type { CardEffect } from './cards.js';
import { GO_BONUS } from './initial.js';
import {
  HOTEL_LEVEL,
  TileKind,
  type GameState,
  type LogEntry,
  type Player,
  type TileIndex,
} from './types.js';

export interface LandingHandler {
  (state: GameState, playerId: string, tileIndex: TileIndex, diceSum: number, rentMultiplier?: number, forceUtilityTenX?: boolean): GameState;
}

export interface PayHandler {
  (state: GameState, payerId: string, payeeId: string | null, amount: number): GameState;
}

export interface CardEffectContext {
  diceSum: number;
  landingHandler: LandingHandler;
  payHandler: PayHandler;
  appendLog: (state: GameState, entries: readonly LogEntry[]) => GameState;
  /** Records a waypoint on the active movement path so the client animates the
   *  card-driven move leg by leg instead of teleporting to the final tile. */
  addWaypoint: (state: GameState, tileIndex: TileIndex) => GameState;
}

export function applyCardEffect(
  state: GameState,
  playerId: string,
  effect: CardEffect,
  ctx: CardEffectContext,
): GameState {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[playerIdx];
  if (!player) return state;

  switch (effect.kind) {
    case 'moveTo':
      return moveTo(state, playerId, effect.tileIndex, effect.collectGo, ctx);
    case 'moveRelative': {
      const newPos = ((player.position + effect.delta) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
      return moveTo(state, playerId, newPos, false, ctx);
    }
    case 'moveToNearestStation': {
      const target = nearestAhead(player.position, STATION_INDICES);
      return moveTo(state, playerId, target, true, ctx, effect.payDouble ? 2 : 1);
    }
    case 'moveToNearestUtility': {
      const target = nearestAhead(player.position, UTILITY_INDICES);
      return moveTo(state, playerId, target, true, ctx, 1, true);
    }
    case 'collectBank':
      return adjustMoney(state, playerIdx, effect.amount);
    case 'payBank':
      return ctx.payHandler(state, playerId, null, effect.amount);
    case 'collectEach':
      return collectFromEach(state, playerId, effect.amount, ctx);
    case 'payEach':
      return payToEach(state, playerId, effect.amount, ctx);
    case 'goToJail': {
      const updated: Player = { ...player, position: JAIL_INDEX, inJail: true, jailTurns: 0 };
      return ctx.addWaypoint(
        {
          ...state,
          players: replaceAt(state.players, playerIdx, updated),
          doublesThisTurn: 0,
        },
        JAIL_INDEX,
      );
    }
    case 'getOutOfJailFree': {
      const updated: Player = { ...player, jailFreeCards: player.jailFreeCards + 1 };
      return { ...state, players: replaceAt(state.players, playerIdx, updated) };
    }
    case 'payRepairs': {
      const total = repairCost(state, player, effect.perHouse, effect.perHotel);
      if (total === 0) return state;
      return ctx.payHandler(state, playerId, null, total);
    }
  }
}

function moveTo(
  state: GameState,
  playerId: string,
  target: TileIndex,
  collectGo: boolean,
  ctx: CardEffectContext,
  rentMultiplier: number = 1,
  forceUtilityTenX: boolean = false,
): GameState {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[playerIdx];
  if (!player) return state;
  const passedGo = collectGo && target < player.position;
  const updated: Player = {
    ...player,
    position: target,
    money: player.money + (passedGo ? GO_BONUS : 0),
  };
  let next: GameState = { ...state, players: replaceAt(state.players, playerIdx, updated) };
  next = ctx.addWaypoint(next, target);
  if (passedGo) {
    next = ctx.appendLog(next, [
      { turn: next.turn, playerId, messageKey: 'log.passedGo', params: { name: player.name, bonus: GO_BONUS } },
    ]);
  }
  next = ctx.appendLog(next, [
    { turn: next.turn, playerId, messageKey: 'log.movedTo', params: { name: player.name, position: target } },
  ]);
  return ctx.landingHandler(next, playerId, target, ctx.diceSum, rentMultiplier, forceUtilityTenX);
}

function adjustMoney(state: GameState, playerIdx: number, delta: number): GameState {
  const player = state.players[playerIdx];
  if (!player) return state;
  return {
    ...state,
    players: replaceAt(state.players, playerIdx, { ...player, money: player.money + delta }),
  };
}

function collectFromEach(
  state: GameState,
  recipientId: string,
  amount: number,
  ctx: CardEffectContext,
): GameState {
  let next = state;
  for (const other of state.players) {
    if (other.id === recipientId || other.bankrupt) continue;
    next = ctx.payHandler(next, other.id, recipientId, amount);
  }
  return next;
}

function payToEach(
  state: GameState,
  payerId: string,
  amount: number,
  ctx: CardEffectContext,
): GameState {
  const payer = state.players.find((p) => p.id === payerId);
  if (!payer) return state;
  const receivers = state.players.filter((p) => p.id !== payerId && !p.bankrupt);
  const total = amount * receivers.length;
  if (payer.money < total) {
    return ctx.payHandler(state, payerId, null, total);
  }
  let next = state;
  for (const r of receivers) {
    next = ctx.payHandler(next, payerId, r.id, amount);
  }
  return next;
}

function repairCost(state: GameState, player: Player, perHouse: number, perHotel: number): number {
  let total = 0;
  for (const tileIndex of player.ownedTiles) {
    const tile = getTile(tileIndex);
    if (tile.kind !== TileKind.STREET) continue;
    const level = getBuildingLevel(state, tileIndex);
    if (level === HOTEL_LEVEL) total += perHotel;
    else total += level * perHouse;
  }
  return total;
}

function nearestAhead(from: TileIndex, candidates: readonly TileIndex[]): TileIndex {
  for (let offset = 1; offset <= BOARD_SIZE; offset++) {
    const idx = (from + offset) % BOARD_SIZE;
    if (candidates.includes(idx)) return idx;
  }
  throw new Error('No tile found ahead');
}

function replaceAt<T>(arr: readonly T[], index: number, value: T): readonly T[] {
  return arr.map((v, i) => (i === index ? value : v));
}
