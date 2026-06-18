import { useEffect, useRef, useState } from 'react';
import { t, type LogEntry } from '@monopoly/core';
import type { GameApi } from './useGame.js';

interface EventOverlayProps {
  api: GameApi;
}

type Popup =
  | { kind: 'card'; deck: 'chance' | 'chest'; color: string; titleKey: string; text: string; id: number }
  | { kind: 'event'; icon: string; titleKey: string; body: string; color: string; id: number };

interface EventRule {
  messageKey: string;
  icon: string;
  titleKey: string;
  color: string;
}

// Notable, "stop and read" events that deserve a popup the player closes manually.
const EVENT_RULES: readonly EventRule[] = [
  { messageKey: 'log.goToJail', icon: '🚔', titleKey: 'event.goToJail', color: '#c0392b' },
  { messageKey: 'log.thirdDoubleJail', icon: '🚔', titleKey: 'event.goToJail', color: '#c0392b' },
  { messageKey: 'log.jailEscape', icon: '🔓', titleKey: 'event.jailEscape', color: '#27ae60' },
  { messageKey: 'log.jailPaid', icon: '🔓', titleKey: 'event.jailPaid', color: '#27ae60' },
  { messageKey: 'log.jailUsedCard', icon: '🎟️', titleKey: 'event.jailEscape', color: '#27ae60' },
  { messageKey: 'log.rentOwed', icon: '💸', titleKey: 'event.rent', color: '#e8943a' },
  { messageKey: 'log.taxOwed', icon: '🏛️', titleKey: 'event.tax', color: '#e8943a' },
  { messageKey: 'log.bankrupt', icon: '💀', titleKey: 'event.bankrupt', color: '#7f8c8d' },
  { messageKey: 'log.gameWon', icon: '🏆', titleKey: 'event.gameWon', color: '#f1c40f' },
];

const CARD_META = {
  'log.drewChance': { deck: 'chance' as const, color: '#e8943a', titleKey: 'tile.chance' },
  'log.drewChest': { deck: 'chest' as const, color: '#4a90d9', titleKey: 'tile.chest' },
};

/**
 * Queued popups for notable events (card draws, jail, rent, etc.). Each popup
 * animates in and waits for the player to close it; the next one then appears.
 * Events are filtered to the local viewer so a friend's turn doesn't spam you.
 */
export function EventOverlay({ api }: EventOverlayProps) {
  const log = api.state.log;
  // `log` is capped at 100 entries, so its length plateaus; `logSeq` is the true
  // running total. Keying off length silently stops popups past 100 entries.
  const logSeq = api.state.logSeq;
  const viewerId = api.viewerPlayerId;
  const [queue, setQueue] = useState<Popup[]>([]);
  const [leaving, setLeaving] = useState(false);
  const seenSeq = useRef<number>(logSeq);
  const nextId = useRef(0);

  useEffect(() => {
    if (logSeq <= seenSeq.current) {
      seenSeq.current = logSeq;
      return;
    }
    // Take only the entries appended since we last looked, clamped to whatever
    // survived the 100-entry cap.
    const newCount = Math.min(logSeq - seenSeq.current, log.length);
    const fresh = log.slice(log.length - newCount);
    seenSeq.current = logSeq;
    const popups = fresh
      .filter((e) => relevant(e, viewerId))
      .map((e) => toPopup(e, () => nextId.current++))
      .filter((p): p is Popup => p !== null);
    if (popups.length > 0) setQueue((q) => [...q, ...popups]);
  }, [logSeq, log, viewerId]);

  const current = queue[0] ?? null;

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      setQueue((q) => q.slice(1));
    }, 280);
  };

  if (!current) return null;

  return (
    <div className="event-overlay">
      <div
        key={current.id}
        className={`card-pop event-pop${leaving ? ' card-pop--leaving' : ''}`}
        style={{ '--card-color': current.color } as React.CSSProperties}
        role="dialog"
      >
        <div className="card-pop__header">
          {current.kind === 'event' ? `${current.icon} ` : ''}
          {t(current.titleKey)}
        </div>
        <div className="card-pop__body">
          {current.kind === 'card' ? current.text : current.body}
        </div>
        <button type="button" className="event-pop__close" onClick={close}>
          {t('game.ok')}
        </button>
        {queue.length > 1 && (
          <div className="event-pop__count">+{queue.length - 1}</div>
        )}
      </div>
    </div>
  );
}

function relevant(e: LogEntry, viewerId: string | null): boolean {
  if (e.messageKey in CARD_META) return viewerId === null || e.playerId === viewerId;
  const rule = EVENT_RULES.find((r) => r.messageKey === e.messageKey);
  if (!rule) return false;
  // Game-over / bankruptcy are shown to everyone; the rest are personal to the
  // acting player (so a friend's turn doesn't pop modals on your screen).
  if (e.messageKey === 'log.gameWon' || e.messageKey === 'log.bankrupt') return true;
  return viewerId === null || e.playerId === viewerId;
}

function toPopup(e: LogEntry, id: () => number): Popup | null {
  const cardMeta = CARD_META[e.messageKey as keyof typeof CARD_META];
  if (cardMeta) {
    const text = e.params?.text;
    return {
      kind: 'card',
      deck: cardMeta.deck,
      color: cardMeta.color,
      titleKey: cardMeta.titleKey,
      text: typeof text === 'string' ? t(text) : '',
      id: id(),
    };
  }
  const rule = EVENT_RULES.find((r) => r.messageKey === e.messageKey);
  if (!rule) return null;
  return {
    kind: 'event',
    icon: rule.icon,
    titleKey: rule.titleKey,
    body: t(e.messageKey, e.params),
    color: rule.color,
    id: id(),
  };
}
