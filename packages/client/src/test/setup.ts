import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Tell React this is an act()-aware environment so manual act() calls (e.g. when
// flushing fake timers) don't warn.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// React Testing Library leaves mounted trees behind between tests unless we
// clean up; vitest only auto-registers this when `globals: true`.
afterEach(() => cleanup());

// jsdom implements neither requestAnimationFrame nor the Web Audio API. The 2D
// board (Tokens) schedules/cancels rAF, and several components import the audio
// module. Provide inert stand-ins so rendering doesn't throw.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as NodeJS.Timeout)) as typeof cancelAnimationFrame;
}

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
}

if (typeof (globalThis as { AudioContext?: unknown }).AudioContext === 'undefined') {
  (globalThis as unknown as { AudioContext: unknown }).AudioContext =
    FakeAudioContext as unknown;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext as unknown;
}
