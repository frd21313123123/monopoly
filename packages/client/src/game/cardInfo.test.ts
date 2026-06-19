import { describe, expect, it } from 'vitest';
import { getCardInfo } from './cardInfo.js';
import { patchPlayer, startedState } from '../test/fakeApi.js';

// Маросейка (index 1): коричневая улица, цена 60, база 2, монополия 4.
const MAROSEJKA = 1;
const VARVARKA = 3; // вторая коричневая
const RIZHSKIJ = 5; // вокзал, цена 200

describe('getCardInfo', () => {
  it('reports an unowned street as for sale with the full rent ladder', () => {
    const st = startedState();
    const info = getCardInfo(st, MAROSEJKA);
    expect(info.owner).toBeNull();
    expect(info.forSale).toBe(true);
    expect(info.price).toBe(60);
    expect(info.mortgageValue).toBe(30);
    expect(info.unmortgageCost).toBe(33);
    expect(info.houseCost).toBe(50);
    expect(info.rents.find((r) => r.label.includes('С отелем'))?.value).toBe(250);
    // Nothing is active until someone owns it.
    expect(info.rents.some((r) => r.active)).toBe(false);
  });

  it('marks the base rent active for an owned single street', () => {
    let st = startedState();
    st = patchPlayer(st, 0, { ownedTiles: [MAROSEJKA] });
    const info = getCardInfo(st, MAROSEJKA);
    expect(info.owner?.name).toBe('Алиса');
    expect(info.forSale).toBe(false);
    const active = info.rents.filter((r) => r.active);
    expect(active).toHaveLength(1);
    expect(active[0]?.value).toBe(2); // base, no monopoly
  });

  it('marks the monopoly rent active when the full group is owned', () => {
    let st = startedState();
    st = patchPlayer(st, 0, { ownedTiles: [MAROSEJKA, VARVARKA] });
    const info = getCardInfo(st, MAROSEJKA);
    const active = info.rents.find((r) => r.active);
    expect(active?.value).toBe(4); // mono
  });

  it('reflects mortgaged tiles with no active rent', () => {
    let st = startedState();
    st = patchPlayer(st, 0, { ownedTiles: [MAROSEJKA] });
    st = { ...st, mortgaged: [MAROSEJKA] };
    const info = getCardInfo(st, MAROSEJKA);
    expect(info.mortgaged).toBe(true);
    expect(info.rents.some((r) => r.active)).toBe(false);
  });

  it('computes station rent by number of stations owned', () => {
    let st = startedState();
    st = patchPlayer(st, 1, { ownedTiles: [RIZHSKIJ] });
    const info = getCardInfo(st, RIZHSKIJ);
    expect(info.owner?.name).toBe('Боб');
    expect(info.price).toBe(200);
    const active = info.rents.find((r) => r.active);
    expect(active?.value).toBe(25); // one station → 25
  });
});
