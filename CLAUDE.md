# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Russian-themed Monopoly clone (Hasbro Moscow edition) built as a pnpm monorepo. Supports both local hot-seat and authoritative-server network multiplayer from the same game engine.

User communicates in Russian — respond in Russian. Game UI strings and street names are also Russian.

## Commands

All commands are run from the repo root. In this git-bash shell, use `corepack pnpm` (not `pnpm.cmd` and not bare `pnpm`).

```bash
corepack pnpm install              # install all workspace deps
corepack pnpm dev                  # run all packages in parallel (Vite :5173 + WS server :8787 + tsc watchers)
corepack pnpm dev:client           # only the Vite client
corepack pnpm dev:server           # only the WS server
corepack pnpm typecheck            # tsc -b across the project references graph
corepack pnpm test                 # vitest run across all packages
corepack pnpm --filter @monopoly/core test    # tests for a single package
corepack pnpm build                # tsc -b + vite build
```

Run a single test file: `corepack pnpm --filter @monopoly/core exec vitest run src/jail.test.ts`
Run a single test by name: `corepack pnpm --filter @monopoly/core exec vitest run -t "third double sends player to jail"`

## Architecture

### Package graph (strict, enforced by tsconfig + pnpm isolation)

```
protocol ─depends on→ core
client   ─depends on→ core, protocol
server   ─depends on→ core, protocol
```

`core` is a sink — it has **no** dependencies on React, Node APIs, or DOM. The same `reduce(state, action)` runs in the browser (hot-seat) and on Node (authoritative server).

### Core purity is enforced by tsconfig, not convention

`packages/core/tsconfig.json` sets `lib: ["ES2023"]` and `types: []`. Adding `document.foo` or `process.env` to a core file is a compile error, not a runtime surprise. **Do not weaken this.**

### The reducer is the entire game

`packages/core/src/reducer.ts` has a single `reduce(state: GameState, action: Action): GameState` covering every game transition: lobby setup, dice rolls, landing effects, card draws, jail flow, building, mortgage, auctions, trades, bankruptcy. Action types are a discriminated union in `types.ts`.

When a player lands on a tile, `processLanding` dispatches by tile kind and may recursively call itself (e.g. a Chance card that moves the player triggers another landing). This recursion is intentional — don't flatten it.

### Determinism via seeded RNG

State carries `rngState: number` (mulberry32 in `rng/dice.ts`). All randomness — dice (`rollDicePure`), deck shuffles (`shuffleDeck`) — is pure: take `rngState` in, return `{ result, nextRngState }`. Tests rely on this; never introduce `Math.random()` into core.

### Pending-state pattern

Several flags gate the action machine: `pendingPurchase`, `pendingOffer`, `pendingAuction`, `pendingTrade`, `pendingEndTurn`, `pendingDebt`. Most actions check these and no-op if blocked. **`endTurn` must check `pendingPurchase`, `pendingOffer`, `pendingAuction`, `pendingTrade`, and `pendingDebt`** — forgetting one allows turns to advance while a modal is still open.

`pendingOffer` backs the "offer this tile to another player" flow: when the current player has a `pendingPurchase` they don't want, `turn/offerPurchase` swaps it for a `pendingOffer` (named price + target player). The target buys it with `offer/accept` (pays the named price to the *offering* player and gets the tile) or rejects with `offer/decline` (restores the original `pendingPurchase`). Authorized in `authorize.ts`: `turn/offerPurchase` is current-player-only, `offer/accept`/`offer/decline` are the offered-to player only.

### Debt instead of instant bankruptcy

When a payment can't be covered, the game does **not** bankrupt immediately. `payOrBankrupt` (reducer.ts) sets `pendingDebt: { debtorId, creditorId, amount, jailMoveSum? }` for the *current* player, pausing the turn so they can raise cash. Two cases still bankrupt instantly: a non-current payer (e.g. a "pay each player" card hitting someone else) and a second simultaneous debt.

While `pendingDebt` is set: rolling, ending the turn, buying houses, unmortgaging, and trading are blocked — but `manage/sellHouse` and `manage/mortgage` stay allowed so the debtor can liquidate (proceeds credit their balance). Resolve via `debt/pay` (clears the debt, pays the creditor/bank, and — if `jailMoveSum` is set from a forced jail fine — leaves jail and completes the move) or `debt/declareBankruptcy` (calls `declareBankruptcy`, then advances the turn). Both actions are authorized as current-player-only in `authorize.ts`.

### Card effects

`card-effects.ts` defines the `CardEffect` discriminated union (`moveTo`, `moveRelative`, `moveToNearestStation`, `collectBank`, `payRepairs`, `goToJail`, `getOutOfJailFree`, etc.) and `applyCardEffect`. The Chance and Community Chest card lists live in `cards.ts`; each card carries an `id`, `textKey` (for i18n), and a `CardEffect`.

### Authoritative server, same reducer

`packages/server/src/server.ts` runs the identical `reduce` from core. Per-room state lives in memory — `packages/server/src/rooms.ts`. Rooms are deleted when the last client disconnects; there is no persistence. Room IDs are 5-char uppercase alphanumeric codes. On `submitAction`:
1. `canSubmitAction` in `authorize.ts` checks the player is allowed (current player for `turn/*`, `manage/*`, `jail/*`; host (index 0) for `lobby/*`; auction turn-holder for `auction/*`; the named players for `trade/*`).
2. `reduce` is called; if state `===` before, an error is sent (the reducer rejected it silently).
3. New state is broadcast to all sockets in the room.

Adding a new action type means **both** writing the reducer case AND adding an authorization rule in `authorize.ts`. Skip the second and any client can spoof any player.

### Protocol package

`packages/protocol/src/messages.ts` defines the WebSocket wire format:
- **Client → Server:** `CreateRoom`, `JoinRoom`, `SubmitAction`, `LeaveRoom`
- **Server → Client:** `RoomCreated`, `RoomJoined`, `StateUpdate`, `ServerError`, `PlayerDisconnected`

`PROTOCOL_VERSION` is a constant to bump on breaking changes. `isClientMsg` / `isServerMsg` are type-guard helpers used in the server's message parser.

### Two GameApi sources

The UI talks to a `GameApi` (`packages/client/src/game/useGame.ts`):
- `useGame` (local hot-seat): plain `useReducer`. `viewerPlayerId` follows current player.
- `useNetworkGame`: WebSocket-backed. `dispatch` sends `submitAction`; state arrives via `stateUpdate`. `viewerPlayerId` is fixed to this client's player.

In sidebar/modal components, gate action buttons on `api.mode === 'local' || api.viewerPlayerId === current.id`. Trade-review modal renders only for the trade recipient (`pendingTrade.toPlayerId === viewerPlayerId`).

The client uses **React Three Fiber / @react-three/drei** for 3D board rendering. `computeWsUrl()` in `App.tsx` derives the WebSocket URL from `location.host` (same origin, `/ws` path) — in production nginx proxies `/ws` → port 8787.

### Client effects: sound, animation gating, event popups

- `client/src/audio/sounds.ts` synthesizes all SFX via Web Audio (no binary assets); the `AudioContext` is created lazily and resumed on first use. The turn-start chime fires only when it's the local viewer's turn (`Sidebar.tsx` compares `turn:currentPlayerIndex`), so a remote player's turn stays silent.
- `client/src/anim.ts` `useMoveGate(rollSeq, diceMs)` returns a timestamp ref; pawns (`board/Tokens.tsx` 2D, `board3d/Tokens3D.tsx` 3D) must not start walking until the dice have settled. The `DICE_ROLL_MS_*` constants here **must stay in sync** with the dice animation durations in `Sidebar.tsx` (2D) and `board3d/Dice3D.tsx` (3D). All dice animations (2D `Dice`, `Dice3D`, the move gate) trigger off `state.rollSeq` — a counter in core bumped only on a real roll — **not** the `lastRoll` object reference. In network mode every `stateUpdate` deserializes a fresh `lastRoll`, so keying on the reference would re-roll the dice after every action.
- `client/src/game/EventOverlay.tsx` derives manually-closed popups from new `log` entries (Chance/Chest draws + notable events). Card draws and most events are filtered to the acting viewer; `log.gameWon` / `log.bankrupt` show to everyone. The 3D card-lift visual in `board3d/Cards3D.tsx` is separate and purely decorative. **The overlay detects new entries via `state.logSeq` (a monotonic counter in core), not `log.length`** — `appendLog` caps `log` at 100 entries, so its length plateaus and length-based detection silently stops firing popups after 100 entries. `logSeq` increments by the number of entries appended on every `appendLogEntries` (and in `startGame`); keep it in sync if you add another log-append path.

### Tile data and i18n

`packages/core/src/board.ts` has all 40 tiles with rent ladders, prices, group. `i18n/ru.ts` maps `nameKey` strings to Russian display for **both** tile names and game log messages (e.g. `log.landedOn`, `log.paidRent`). `LogEntry` uses `messageKey` + `params` (key-value bag). When adding a card effect or new tile kind, update `board.ts`, `i18n/ru.ts`, and the card list in `cards.ts` if applicable.

`t()` recursively translates a param value **only** when it is itself a key prefixed `tile.`, `token.`, or `card.` (e.g. the `{text}` param on `log.drewChance` is a `card.*` key). If you introduce a new prefix of nested keys passed through params, add it to that check in `ru.ts` or the param will render as a raw code.

### `as const` objects instead of `enum`

`isolatedModules: true` (required for Vite) is incompatible with `const enum`. Use `as const` objects with a derived type:
```ts
export const TileKind = { GO: 'GO', ... } as const;
export type TileKind = (typeof TileKind)[keyof typeof TileKind];
```
String values also serialize cleanly over WebSocket.

### Workspace HMR trick

Each in-repo package's `package.json` has an `exports` map with `"development": "./src/index.ts"`. Vite resolves the `development` condition, so editing core sources hot-reloads the client without a `tsc -b`. Don't remove this — Vite then resolves to `dist/` and HMR breaks.

### Verbatim module syntax

`verbatimModuleSyntax: true` is on. Type-only imports must be `import type { Foo } from '...'`. Mixing runtime and type imports in one statement is rejected.

### Test strategy

Tests are co-located (`*.test.ts` / `*.test.tsx` next to source) and exist in **all four packages**. Each package owns a `vitest.config.ts` (`node` env for core/protocol/server, `jsdom` for client); the root `vitest.workspace.ts` globs `packages/*/vitest.config.ts`, so a new package needs its own config to be picked up by `corepack pnpm test`.

**core** — pure-function and reducer coverage. Key helpers in `reducer.test.ts`:
- `lobbyWithTwo()` / `startedGame()` — minimal two-player setup with seed 12345.
- `findSeedForSum(n)` — finds an RNG seed whose first roll sums to `n`. Sums of 2 and 12 are always doubles; `opts.allowDouble` must be passed for those.
- `findDoubleSeed()` / `findNonDoubleSeed()` — helpers for jail tests.
- `landAt(state, { target, playerIndex })` — patches position and RNG so the next roll lands exactly on `target`.
- `settlePending(state)` — declines `pendingPurchase` then drains `pendingAuction` by passing each active player in turn. Must do both because declining now triggers an auction when ≥2 active players exist.
- `patchPlayer(state, index, patch)` — immutable player field override for test setup.

Auction `MIN_BID_INCREMENT` is 10; bids below `currentBid + 10` are rejected by the reducer.

**server** — `authorize.test.ts` and `rooms.test.ts` are unit tests; `server.test.ts` is a real integration test that boots a `WebSocketServer` on port 0 and drives `ws` clients through create/join/submit/leave. The room store in `rooms.ts` is a module-level singleton with no reset hook — tests assert on rooms they create or use `listRooms()` deltas rather than absolute counts.

**client** — React component/hook tests via `@testing-library/react`. Shared scaffolding:
- `src/test/setup.ts` (wired in `vitest.config.ts` `setupFiles`) registers RTL `cleanup`, sets `IS_REACT_ACT_ENVIRONMENT`, and polyfills `requestAnimationFrame`/`cancelAnimationFrame` and a stub `AudioContext` — jsdom has none, and `Tokens`/the audio module need them at render time.
- `src/test/fakeApi.ts` — `makeApi(state, overrides)` wraps a `GameState` in a `GameApi` with a spy `dispatch`; `startedState(seed)` builds a post-lobby two-player game; `patchPlayer` mirrors the core helper. Note `startedState()` already has `logSeq ≥ 1` (startGame logs), so `EventOverlay` tests must append onto `base.log`/`base.logSeq`, not overwrite them.
- Only WebGL/three.js views (`board3d/*`, `Game.tsx`) are intentionally untested — three.js doesn't run in jsdom; the 3D geometry is covered indirectly via `board3d/layout3d.test.ts`.

## Key files

- `packages/core/src/types.ts` — `GameState`, `Action`, all field meanings
- `packages/core/src/reducer.ts` — entire game flow
- `packages/core/src/board.ts` — 40 tile definitions and rent tables
- `packages/core/src/card-effects.ts` — `CardEffect` union and `applyCardEffect`
- `packages/core/src/ownership.ts` — `computeRent`, `findOwner`, `isPurchasable`
- `packages/core/src/buildings.ts` — `canBuyHouse`, `canSellHouse`, building level helpers
- `packages/core/src/trading.ts` — `canMortgage`, `canUnmortgage`, `makeAuction`, `tradeBundleValid`
- `packages/core/src/i18n/ru.ts` — all Russian strings (tile names + log messages)
- `packages/server/src/authorize.ts` — per-action authorization rules
- `packages/server/src/rooms.ts` — in-memory room store and lifecycle
- `packages/client/src/game/useGame.ts` — `GameApi` interface and both implementations
- `packages/client/src/game/Sidebar.tsx` — how the UI reads `viewerPlayerId` and gates buttons; dice flicker + turn-start chime
- `packages/client/src/game/DebtModal.tsx` — sell/mortgage UI shown while `pendingDebt` is set
- `packages/client/src/game/EventOverlay.tsx` — manually-closed card/event popups driven off the log
- `packages/client/src/anim.ts` / `packages/client/src/audio/sounds.ts` — dice-settle move gate and Web Audio SFX

## Deployment

No git-based deploy. Production lives at `/opt/monopoly` on the host (not a git repo — it's an unpacked source tree), served by nginx (`/etc/nginx/sites-enabled/monopoly`, domain `wave-projects.com` with `/ws` proxied to :8787) and run by pm2 process `monopoly-server` (`packages/server/dist/index.js`). To update: upload sources, `corepack pnpm install && corepack pnpm build` on the host, then `pm2 restart monopoly-server` and `systemctl reload nginx`.
