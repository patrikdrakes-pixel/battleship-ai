export type SoundName = 'miss' | 'hit' | 'sunk' | 'win' | 'loss';

interface Tone {
  readonly type: OscillatorType;
  /** Start and end frequency in Hz; a glide when they differ. */
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly gain: number;
  /** Seconds to wait before this tone starts, for short sequences. */
  readonly delay: number;
}

/** Synthesised on the fly, so the game ships no audio assets. */
const TONES: Readonly<Record<SoundName, readonly Tone[]>> = {
  miss: [{ type: 'sine', from: 320, to: 180, duration: 0.18, gain: 0.05, delay: 0 }],
  hit: [{ type: 'square', from: 200, to: 90, duration: 0.22, gain: 0.06, delay: 0 }],
  sunk: [
    { type: 'sawtooth', from: 260, to: 70, duration: 0.5, gain: 0.07, delay: 0 },
    { type: 'square', from: 150, to: 60, duration: 0.35, gain: 0.05, delay: 0.08 },
  ],
  win: [
    { type: 'triangle', from: 523, to: 523, duration: 0.16, gain: 0.06, delay: 0 },
    { type: 'triangle', from: 659, to: 659, duration: 0.16, gain: 0.06, delay: 0.16 },
    { type: 'triangle', from: 784, to: 784, duration: 0.3, gain: 0.06, delay: 0.32 },
  ],
  loss: [
    { type: 'triangle', from: 392, to: 392, duration: 0.2, gain: 0.06, delay: 0 },
    { type: 'triangle', from: 294, to: 294, duration: 0.2, gain: 0.06, delay: 0.2 },
    { type: 'triangle', from: 196, to: 196, duration: 0.45, gain: 0.06, delay: 0.4 },
  ],
};

export interface SoundPlayer {
  play(name: SoundName): void;
  close(): void;
}

type AudioContextCtor = new () => AudioContext;

function defaultContext(): AudioContext | null {
  const ctor = (globalThis as { AudioContext?: AudioContextCtor }).AudioContext;
  if (ctor === undefined) return null;
  return new ctor();
}

/**
 * WebAudio blips. The context is created on the first play — i.e. inside a user
 * gesture, as autoplay policies require — and every failure is swallowed:
 * audio is decoration and must never break the game.
 */
export function createSoundPlayer(
  createContext: () => AudioContext | null = defaultContext,
): SoundPlayer {
  let context: AudioContext | null = null;

  function ensureContext(): AudioContext | null {
    if (context === null) context = createContext();
    if (context !== null && context.state === 'suspended') void context.resume();
    return context;
  }

  return {
    play(name: SoundName): void {
      try {
        const ctx = ensureContext();
        if (ctx === null) return;
        for (const tone of TONES[name]) {
          const start = ctx.currentTime + tone.delay;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = tone.type;
          osc.frequency.setValueAtTime(tone.from, start);
          if (tone.to !== tone.from) {
            osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.duration);
          }
          gain.gain.setValueAtTime(tone.gain, start);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + tone.duration);
        }
      } catch {
        // Unavailable or blocked audio stays silent.
      }
    },
    close(): void {
      try {
        void context?.close();
      } catch {
        // Ignore: the context may already be closed.
      }
      context = null;
    },
  };
}
