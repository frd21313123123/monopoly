# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Russian-themed Monopoly clone (Hasbro Moscow edition) built as a pnpm monorepo. Supports both local hot-seat and authoritative-server network multiplayer from the same game engine.

User communicates in Russian — respond in Russian. Game UI strings and street names are also Russian.

## Commands

All commands are run from the repo root. On this Windows + git-bash setup, `pnpm` is not on PATH — invoke as `pnpm.cmd` from Bash tool calls.

```bash
pnpm.cmd install              # install all workspace deps
pnpm.cmd dev                  # run all 4 packages in parallel (Vite + WS server + tsc watchers)
pnpm.cmd dev:client           # only the client (Vite on :5173)
pnpm.cmd dev:server           # only the WS server (:8787)
pnpm.cmd typecheck            # tsc -b across the project references graph
pnpm.cmd test                 # vitest run across all packages
pnpm.cmd --filter @monopoly/core test    # tests for a single package
pnpm.cmd build                # tsc -b + vite build
```

Run a single test file: `pnpm.cmd --filter @monopoly/core exec vitest run src/jail.test.ts`
Run a single test by name: `pnpm.cmd --filter @monopoly/core exec vitest run -t "third double sends player to jail"`

The dev orchestration is `pnpm -r --parallel --stream run dev` — no separate `concurrently` package.

## Architecture

### Package graph (strict, enforced by tsconfig + pnpm isolation)

```
protocol ─depends on→ core
client   ─depends on→ core, protocol
server   ─depends on→ core, protocol
```

`core` is a sink — it has **no** dependencies on React, Node APIs, or DOM. The same `reduce(state, action)` runs in the browser (hot-seat) and on Node (authoritative server).

### Core purity is enforced by tsconfig, not convention

`packages/core/tsconfig.json` sets `lib: ["ES2023"]` and `types: []`. Adding `document.foo` or `process.env` to a core file is a compile error, not a runtime surprise. **Do not weaken this** — it's the guardrail that makes the same engine work in browser and Node.

### The reducer is the entire game

`packages/core/src/reducer.ts` has a single `reduce(state: GameState, action: Action): GameState` covering every game transition: lobby setup, dice rolls, landing effects, card draws, jail flow, building, mortgage, auctions, trades, bankruptcy. Action types are a discriminated union in `types.ts`.

When a player lands on a tile, `processLanding` dispatches by tile kind and may recursively call itself (e.g. a Chance card that moves the player triggers another landing). This recursion is intentional — don't try to "flatten" it.

### Determinism via seeded RNG

State carries `rngState: number` (mulberry32). All randomness — dice (`rollDicePure`), deck shuffles (`shuffleDeck`) — is pure: take state in, return `{ result, nextRngState }`. Tests rely on this; never introduce `Math.random()` into core.

### Pending-state pattern

Several flags gate the action machine: `pendingPurchase`, `pendingAuction`, `pendingTrade`, `pendingEndTurn`. Most actions check these and no-op if blocked. **`endTurn` must check all four** — forgetting one allows turns to advance while a modal is still open.

### Authoritative server, same reducer

`packages/server/src/server.ts` runs the identical `reduce` from core. Per-room state lives in memory (`packages/server/src/rooms.ts`). On `submitAction`:
1. `canSubmitAction` in `authorize.ts` checks the player is allowed (current player for turn/* and manage/*, host for lobby/*, recipient for trade/accept, etc.)
2. `reduce` is called; if state === before, error is sent (the reducer rejected it)
3. New state is broadcast to all sockets in the room

Adding a new action type means **both** writing the reducer case AND adding an authorization rule. Skip the second and any client can spoof any player.

### Two GameApi sources

The UI talks to a `GameApi` (`packages/client/src/game/useGame.ts`):
- `useGame` (local hot-seat): plain `useReducer`. `viewerPlayerId` follows current player.
- `useNetworkGame`: WebSocket-backed. `dispatch` sends `submitAction`; state arrives via `stateUpdate`. `viewerPlayerId` is fixed to this client's player.

In sidebar/modal components, gate action buttons on `api.mode === 'local' || api.viewerPlayerId === current.id`. Trade-review modal renders only for the trade recipient (`pendingTrade.toPlayerId === viewerPlayerId`).

### Tile data is the source of truth

`packages/core/src/board.ts` has all 40 tiles with rent ladders, prices, group. `i18n/ru.ts` maps `nameKey` strings to Russian display. When adding a card effect or new tile kind, update both files — the `nameKey` indirection is what keeps the data table separate from localization.

### `as const` objects instead of `enum`

`isolatedModules: true` (required for Vite) is incompatible with `const enum`. Use `as const` objects with a derived type:
```ts
export const TileKind = { GO: 'GO', ... } as const;
export type TileKind = (typeof TileKind)[keyof typeof TileKind];
```
String values also serialize cleanly over WebSocket.

### Workspace HMR trick

Each in-repo package's `package.json` has an `exports` map with `"development": "./src/index.ts"`. Vite resolves the `development` condition, so editing core sources hot-reloads the client without waiting for `tsc -b`. Don't remove this — Vite then resolves to `dist/` and HMR breaks.

### Verbatim module syntax

`verbatimModuleSyntax: true` is on. Type-only imports must be `import type { Foo } from '...'`. Mixing runtime and type imports in one statement is rejected.

### Test strategy

Tests are co-located (`*.test.ts` next to source) and only in `core`. They use deterministic seed helpers like `findSeedForSum(n)` and `landAt(s, { target })` — search `reducer.test.ts` for the patterns. Sums of 2 and 12 are always doubles; helpers that pick a "non-double sum" must skip those. The `settlePending` helper has to clear both `pendingPurchase` AND drain `pendingAuction` (decline now triggers an auction with ≥2 active players).

## Files worth reading first

When picking up a new task:
- `packages/core/src/types.ts` — `GameState`, `Action`, all field meanings
- `packages/core/src/reducer.ts` — the entire game flow in one file
- `packages/core/src/board.ts` — tile data and rent tables
- `packages/server/src/authorize.ts` — what each action requires from the submitter
- `packages/client/src/game/Sidebar.tsx` — how the UI reads `viewerPlayerId` and gates buttons
