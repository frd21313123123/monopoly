import { mulberry32Step } from './rng/dice.js';
import type { TileIndex } from './types.js';

export const CardDeck = {
  CHANCE: 'CHANCE',
  CHEST: 'CHEST',
} as const;
export type CardDeck = (typeof CardDeck)[keyof typeof CardDeck];

export type CardEffect =
  | { kind: 'moveTo'; tileIndex: TileIndex; collectGo: boolean }
  | { kind: 'moveRelative'; delta: number }
  | { kind: 'moveToNearestStation'; payDouble: boolean }
  | { kind: 'moveToNearestUtility' }
  | { kind: 'collectBank'; amount: number }
  | { kind: 'payBank'; amount: number }
  | { kind: 'collectEach'; amount: number }
  | { kind: 'payEach'; amount: number }
  | { kind: 'goToJail' }
  | { kind: 'getOutOfJailFree'; deck: CardDeck }
  | { kind: 'payRepairs'; perHouse: number; perHotel: number };

export interface Card {
  id: string;
  textKey: string;
  effect: CardEffect;
}

export const CHANCE_CARDS: readonly Card[] = [
  { id: 'chance-1', textKey: 'card.chance.advanceToGo', effect: { kind: 'moveTo', tileIndex: 0, collectGo: true } },
  { id: 'chance-2', textKey: 'card.chance.toProspektMira', effect: { kind: 'moveTo', tileIndex: 24, collectGo: true } },
  { id: 'chance-3', textKey: 'card.chance.toMalayaBronnaya', effect: { kind: 'moveTo', tileIndex: 39, collectGo: false } },
  { id: 'chance-4', textKey: 'card.chance.toPolyanka', effect: { kind: 'moveTo', tileIndex: 11, collectGo: true } },
  { id: 'chance-5', textKey: 'card.chance.nearestStation', effect: { kind: 'moveToNearestStation', payDouble: true } },
  { id: 'chance-6', textKey: 'card.chance.buildingLoan', effect: { kind: 'collectBank', amount: 150 } },
  { id: 'chance-7', textKey: 'card.chance.nearestUtility', effect: { kind: 'moveToNearestUtility' } },
  { id: 'chance-8', textKey: 'card.chance.bankDividend', effect: { kind: 'collectBank', amount: 50 } },
  { id: 'chance-9', textKey: 'card.chance.jailFree', effect: { kind: 'getOutOfJailFree', deck: CardDeck.CHANCE } },
  { id: 'chance-10', textKey: 'card.chance.goBack3', effect: { kind: 'moveRelative', delta: -3 } },
  { id: 'chance-11', textKey: 'card.chance.goToJail', effect: { kind: 'goToJail' } },
  { id: 'chance-12', textKey: 'card.chance.generalRepairs', effect: { kind: 'payRepairs', perHouse: 25, perHotel: 100 } },
  { id: 'chance-13', textKey: 'card.chance.speedingFine', effect: { kind: 'payBank', amount: 15 } },
  { id: 'chance-14', textKey: 'card.chance.toRizhskij', effect: { kind: 'moveTo', tileIndex: 5, collectGo: true } },
  { id: 'chance-15', textKey: 'card.chance.chairman', effect: { kind: 'payEach', amount: 50 } },
  { id: 'chance-16', textKey: 'card.chance.loanMatured', effect: { kind: 'collectBank', amount: 150 } },
];

export const CHEST_CARDS: readonly Card[] = [
  { id: 'chest-1', textKey: 'card.chest.bankError', effect: { kind: 'collectBank', amount: 200 } },
  { id: 'chest-2', textKey: 'card.chest.stockSale', effect: { kind: 'collectBank', amount: 50 } },
  { id: 'chest-3', textKey: 'card.chest.jailFree', effect: { kind: 'getOutOfJailFree', deck: CardDeck.CHEST } },
  { id: 'chest-4', textKey: 'card.chest.goToJail', effect: { kind: 'goToJail' } },
  { id: 'chest-5', textKey: 'card.chest.taxRefund', effect: { kind: 'collectBank', amount: 20 } },
  { id: 'chest-6', textKey: 'card.chest.birthday', effect: { kind: 'collectEach', amount: 10 } },
  { id: 'chest-7', textKey: 'card.chest.doctorFee', effect: { kind: 'payBank', amount: 50 } },
  { id: 'chest-8', textKey: 'card.chest.hospitalFee', effect: { kind: 'payBank', amount: 100 } },
  { id: 'chest-9', textKey: 'card.chest.schoolFees', effect: { kind: 'payBank', amount: 150 } },
  { id: 'chest-10', textKey: 'card.chest.inheritance', effect: { kind: 'collectBank', amount: 100 } },
  { id: 'chest-11', textKey: 'card.chest.interest', effect: { kind: 'collectBank', amount: 25 } },
  { id: 'chest-12', textKey: 'card.chest.beautyContest', effect: { kind: 'collectBank', amount: 10 } },
  { id: 'chest-13', textKey: 'card.chest.insuranceMatured', effect: { kind: 'collectBank', amount: 100 } },
  { id: 'chest-14', textKey: 'card.chest.consultancy', effect: { kind: 'collectBank', amount: 45 } },
  { id: 'chest-15', textKey: 'card.chest.repairs', effect: { kind: 'payRepairs', perHouse: 40, perHotel: 115 } },
  { id: 'chest-16', textKey: 'card.chest.holidayFund', effect: { kind: 'collectBank', amount: 100 } },
];

export function shuffleDeck(deckLength: number, rngState: number): { order: readonly number[]; nextRngState: number } {
  const order = Array.from({ length: deckLength }, (_, i) => i);
  let state = rngState;
  for (let i = order.length - 1; i > 0; i--) {
    const r = mulberry32Step(state);
    state = r.next;
    const j = Math.floor(r.value * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return { order, nextRngState: state };
}

export function getChanceCard(index: number): Card {
  const card = CHANCE_CARDS[index];
  if (!card) throw new Error(`No chance card ${index}`);
  return card;
}

export function getChestCard(index: number): Card {
  const card = CHEST_CARDS[index];
  if (!card) throw new Error(`No chest card ${index}`);
  return card;
}
