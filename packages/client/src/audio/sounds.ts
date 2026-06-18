/**
 * Tiny synthesized sound effects via the Web Audio API — no binary assets.
 * The AudioContext is created lazily on first use and resumed on demand, so it
 * survives the browser autoplay policy (the first sound usually follows a click).
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  duration: number;
  gain?: number;
  /** Linear ramp end frequency, for little slides. */
  freqEnd?: number;
  delay?: number;
}

function tone({ freq, type = 'sine', duration, gain = 0.15, freqEnd, delay = 0 }: ToneOpts): void {
  const ac = audioCtx();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, start + duration);
  // Quick attack, smooth exponential release.
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Short pleasant rising chime when it becomes the local player's turn. */
export function playTurnStart(): void {
  tone({ freq: 523.25, type: 'triangle', duration: 0.16, gain: 0.16 });
  tone({ freq: 659.25, type: 'triangle', duration: 0.16, gain: 0.16, delay: 0.1 });
  tone({ freq: 783.99, type: 'triangle', duration: 0.22, gain: 0.18, delay: 0.2 });
}

/** Rattling clack for a dice roll. */
export function playDiceRoll(): void {
  const ac = audioCtx();
  if (!ac) return;
  // A few short noisy clicks to suggest tumbling dice.
  for (let i = 0; i < 5; i++) {
    tone({
      freq: 140 + (i % 2 === 0 ? 60 : 0) + i * 12,
      type: 'square',
      duration: 0.05,
      gain: 0.05,
      delay: i * 0.09,
    });
  }
}

/** Soft tick for a single pawn step. */
export function playStep(): void {
  tone({ freq: 320, type: 'sine', duration: 0.07, gain: 0.06, freqEnd: 220 });
}

/** Light thud when a pawn lands on its destination tile. */
export function playLand(): void {
  tone({ freq: 200, type: 'sine', duration: 0.16, gain: 0.12, freqEnd: 120 });
}
