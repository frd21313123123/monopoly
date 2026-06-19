import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DICE_ROLL_MS_2D,
  DICE_ROLL_MS_3D,
  MOVE_AFTER_DICE_BUFFER,
  useMoveGate,
} from './anim.js';

describe('timing constants', () => {
  it('are positive numbers', () => {
    expect(DICE_ROLL_MS_2D).toBeGreaterThan(0);
    expect(DICE_ROLL_MS_3D).toBeGreaterThan(0);
    expect(MOVE_AFTER_DICE_BUFFER).toBeGreaterThan(0);
  });
});

describe('useMoveGate', () => {
  it('starts wide open (-Infinity) and does not arm on first render', () => {
    const { result } = renderHook(({ seq }) => useMoveGate(seq, 100), {
      initialProps: { seq: 0 },
    });
    expect(result.current.current).toBe(-Infinity);
  });

  it('arms the gate into the future when rollSeq changes', () => {
    const diceMs = 500;
    const { result, rerender } = renderHook(({ seq }) => useMoveGate(seq, diceMs), {
      initialProps: { seq: 0 },
    });
    const before = performance.now();
    rerender({ seq: 1 });
    const gate = result.current.current;
    expect(gate).toBeGreaterThanOrEqual(before + diceMs + MOVE_AFTER_DICE_BUFFER);
  });

  it('does not re-arm when rollSeq is unchanged across rerenders', () => {
    const { result, rerender } = renderHook(({ seq }) => useMoveGate(seq, 200), {
      initialProps: { seq: 5 },
    });
    rerender({ seq: 6 });
    const armed = result.current.current;
    expect(armed).toBeGreaterThan(0);
    // Re-render with the SAME seq — the gate timestamp must not move.
    rerender({ seq: 6 });
    expect(result.current.current).toBe(armed);
  });
});
