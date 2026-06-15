export interface Rng {
  next(): number;
}

export interface DiceRoll {
  a: number;
  b: number;
  sum: number;
  isDouble: boolean;
}

export function mulberry32Step(state: number): { value: number; next: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next };
}

export function createMulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      const r = mulberry32Step(state);
      state = r.next;
      return r.value;
    },
  };
}

export function rollDicePure(rngState: number): { roll: DiceRoll; nextRngState: number } {
  const r1 = mulberry32Step(rngState);
  const a = 1 + Math.floor(r1.value * 6);
  const r2 = mulberry32Step(r1.next);
  const b = 1 + Math.floor(r2.value * 6);
  return {
    roll: { a, b, sum: a + b, isDouble: a === b },
    nextRngState: r2.next,
  };
}

export function rollDice(rng: Rng): DiceRoll {
  const a = 1 + Math.floor(rng.next() * 6);
  const b = 1 + Math.floor(rng.next() * 6);
  return { a, b, sum: a + b, isDouble: a === b };
}
