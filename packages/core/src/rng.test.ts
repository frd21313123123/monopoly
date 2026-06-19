import { describe, expect, it } from 'vitest';
import {
  createMulberry32,
  mulberry32Step,
  rollDice,
  rollDicePure,
} from './rng/dice.js';
import { shuffleDeck } from './cards.js';

describe('mulberry32Step', () => {
  it('is deterministic', () => {
    expect(mulberry32Step(12345)).toEqual(mulberry32Step(12345));
  });

  it('produces values in [0, 1)', () => {
    let state = 1;
    for (let i = 0; i < 1000; i++) {
      const r = mulberry32Step(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(r.next).toBeGreaterThanOrEqual(0);
      state = r.next;
    }
  });

  it('different seeds yield different first values', () => {
    expect(mulberry32Step(1).value).not.toBe(mulberry32Step(2).value);
  });
});

describe('createMulberry32', () => {
  it('matches the pure step sequence', () => {
    const rng = createMulberry32(999);
    const a = mulberry32Step(999);
    const b = mulberry32Step(a.next);
    expect(rng.next()).toBe(a.value);
    expect(rng.next()).toBe(b.value);
  });
});

describe('rollDicePure', () => {
  it('is deterministic for a given state', () => {
    expect(rollDicePure(54321)).toEqual(rollDicePure(54321));
  });

  it('returns dice in 1..6 and a correct sum/double flag', () => {
    let state = 7;
    for (let i = 0; i < 2000; i++) {
      const { roll, nextRngState } = rollDicePure(state);
      expect(roll.a).toBeGreaterThanOrEqual(1);
      expect(roll.a).toBeLessThanOrEqual(6);
      expect(roll.b).toBeGreaterThanOrEqual(1);
      expect(roll.b).toBeLessThanOrEqual(6);
      expect(roll.sum).toBe(roll.a + roll.b);
      expect(roll.isDouble).toBe(roll.a === roll.b);
      state = nextRngState;
    }
  });

  it('advances the rng state', () => {
    expect(rollDicePure(1).nextRngState).not.toBe(1);
  });
});

describe('rollDice (stateful)', () => {
  it('returns dice in range', () => {
    const rng = createMulberry32(123);
    for (let i = 0; i < 100; i++) {
      const roll = rollDice(rng);
      expect(roll.a).toBeGreaterThanOrEqual(1);
      expect(roll.b).toBeLessThanOrEqual(6);
      expect(roll.sum).toBe(roll.a + roll.b);
    }
  });
});

describe('shuffleDeck', () => {
  it('returns a permutation of 0..n-1', () => {
    const { order } = shuffleDeck(16, 42);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
  });

  it('is deterministic for a given seed', () => {
    expect(shuffleDeck(16, 7)).toEqual(shuffleDeck(16, 7));
  });

  it('different seeds usually give different orders', () => {
    expect(shuffleDeck(16, 1).order).not.toEqual(shuffleDeck(16, 2).order);
  });

  it('advances the rng state', () => {
    expect(shuffleDeck(16, 5).nextRngState).not.toBe(5);
  });

  it('handles a single-element deck', () => {
    expect(shuffleDeck(1, 99).order).toEqual([0]);
  });
});
