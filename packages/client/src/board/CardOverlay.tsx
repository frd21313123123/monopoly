import { useEffect, useRef, useState } from 'react';
import { t, type GameState, type LogEntry } from '@monopoly/core';

interface CardOverlayProps {
  state?: GameState | undefined;
}

type DeckKey = 'chance' | 'chest';

interface DeckConfig {
  key: DeckKey;
  drewKey: string;
  titleKey: string;
  color: string;
}

const DECKS: DeckConfig[] = [
  { key: 'chance', drewKey: 'log.drewChance', titleKey: 'tile.chance', color: '#e8943a' },
  { key: 'chest', drewKey: 'log.drewChest', titleKey: 'tile.chest', color: '#4a90d9' },
];

// Timeline (ms): slide-in/grow → hold (readable) → fade-out.
const HOLD_MS = 2600;
const OUT_MS = 450;

interface Drawn {
  deck: DeckConfig;
  text: string;
  logLen: number;
}

/** Overlay that pops the most recently drawn Chance / Community Chest card over the 2D board. */
export function CardOverlay({ state }: CardOverlayProps) {
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Remember how far into the log we've already reacted, so re-renders don't re-trigger.
  const seenLen = useRef<number>(state?.log.length ?? 0);

  useEffect(() => {
    const log = state?.log ?? [];
    if (log.length <= seenLen.current) {
      seenLen.current = log.length;
      return;
    }
    const fresh = log.slice(seenLen.current);
    seenLen.current = log.length;
    const hit = latestDraw(fresh);
    if (hit) {
      setLeaving(false);
      setDrawn({ deck: hit.deck, text: t(hit.text), logLen: log.length });
    }
  }, [state?.log]);

  useEffect(() => {
    if (!drawn) return;
    const toLeave = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const toClear = window.setTimeout(() => setDrawn(null), HOLD_MS + OUT_MS);
    return () => {
      window.clearTimeout(toLeave);
      window.clearTimeout(toClear);
    };
  }, [drawn]);

  if (!drawn) return null;

  return (
    <div className="card-overlay" aria-hidden={false}>
      <div
        key={drawn.logLen}
        className={`card-pop${leaving ? ' card-pop--leaving' : ''}`}
        style={{ '--card-color': drawn.deck.color } as React.CSSProperties}
        role="dialog"
        aria-label={t(drawn.deck.titleKey)}
      >
        <div className="card-pop__header">{t(drawn.deck.titleKey)}</div>
        <div className="card-pop__body">{drawn.text}</div>
      </div>
    </div>
  );
}

function latestDraw(entries: readonly LogEntry[]): { deck: DeckConfig; text: string } | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    const deck = DECKS.find((d) => d.drewKey === e.messageKey);
    if (deck) {
      const text = e.params?.text;
      return { deck, text: typeof text === 'string' ? text : '' };
    }
  }
  return null;
}
