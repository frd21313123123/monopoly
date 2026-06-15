# Monopoly

Клон настольной «Монополии» (российское издание Hasbro) на TypeScript + React + SVG.

## Структура

- `packages/core` — игровая логика (типы, board, reducer, правила). Чистый TS, без React и Node API.
- `packages/protocol` — типы WebSocket-сообщений между клиентом и сервером.
- `packages/client` — Vite + React, SVG-рендер поля.
- `packages/server` — Node + ws, authoritative state для сетевого режима.

## Команды

```bash
pnpm install        # установить зависимости
pnpm dev            # запустить клиент и сервер параллельно
pnpm typecheck      # проверить типы во всём монорепо
pnpm test           # vitest по всем пакетам
pnpm lint           # eslint
pnpm format         # prettier --write .
```

Клиент: http://localhost:5173 · Сервер WS: ws://localhost:8787

## Требования

Node ≥ 22, pnpm ≥ 9.
