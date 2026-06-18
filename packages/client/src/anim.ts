import { useEffect, useRef } from 'react';

/** How long the 3D dice tumble before they settle (must match Dice3D). */
export const DICE_ROLL_MS_3D = 1500;
/** How long the 2D sidebar dice flicker before settling (must match Sidebar Dice). */
export const DICE_ROLL_MS_2D = 700;
/** Small extra pause after the dice land before pawns start walking. */
export const MOVE_AFTER_DICE_BUFFER = 180;

/**
 * Returns a ref holding the `performance.now()` timestamp at which pawn movement
 * is allowed to begin — i.e. once the dice have finished showing their result.
 * Pawns read this so they never start walking while the dice are still spinning.
 *
 * Keyed on `rollSeq` (a counter bumped only on a real roll), not the `lastRoll`
 * object reference — in network mode every state update is a fresh object, which
 * would otherwise re-trigger the dice animation after any action.
 */
export function useMoveGate(rollSeq: number, diceMs: number): React.MutableRefObject<number> {
  const gate = useRef<number>(-Infinity);
  const prev = useRef<number>(rollSeq);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      prev.current = rollSeq;
      return;
    }
    if (rollSeq !== prev.current) {
      prev.current = rollSeq;
      gate.current = performance.now() + diceMs + MOVE_AFTER_DICE_BUFFER;
    }
  }, [rollSeq, diceMs]);
  return gate;
}
