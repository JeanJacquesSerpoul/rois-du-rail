/**
 * Effets sonores du jeu, synthétisés avec la Web Audio API (aucun fichier audio),
 * comme la musique. Volume volontairement discret.
 */

const VOLUME = 0.35;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let lastPlay = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.6);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number) {
  const c = ctx!;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env).connect(master!);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function hiss(start: number, dur: number, gain: number, freq: number, q = 1, sweepTo?: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, start);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
  filter.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(env).connect(master!);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export type Sound = 'card' | 'whistle' | 'tickets' | 'chime' | 'bell' | 'error' | 'fanfare';

const SOUNDS: Record<Sound, (t: number) => void> = {
  // carte glissée sur la table
  card: (t) => {
    hiss(t, 0.12, 0.5, 2600, 0.7, 900);
    tone(1800, t, 0.03, 0.08, 'triangle');
  },
  // sifflet de locomotive et deux « tchou »
  whistle: (t) => {
    for (const [f, g] of [
      [740, 0.18],
      [932, 0.14],
      [1109, 0.1],
    ] as const) {
      tone(f, t, 0.55, g, 'sine');
      tone(f * 1.01, t + 0.02, 0.5, g / 2, 'triangle');
    }
    hiss(t + 0.45, 0.16, 0.45, 900, 0.8);
    hiss(t + 0.68, 0.16, 0.35, 800, 0.8);
  },
  // billets froissés
  tickets: (t) => {
    hiss(t, 0.22, 0.35, 3500, 0.5, 1500);
    hiss(t + 0.14, 0.18, 0.25, 4200, 0.5, 2000);
  },
  // billet réalisé : carillon
  chime: (t) => {
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      tone(f, t + i * 0.09, 0.9, 0.16, 'triangle');
    });
  },
  // cloche de gare : dernier tour
  bell: (t) => {
    for (const s of [0, 0.45]) {
      for (const [f, g] of [
        [523, 0.22],
        [1229, 0.09],
        [1660, 0.06],
      ] as const) {
        tone(f, t + s, 1.4, g, 'sine');
      }
    }
  },
  error: (t) => {
    tone(196, t, 0.18, 0.12, 'square', 150);
  },
  // petite fanfare quand la musique est coupée
  fanfare: (t) => {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, t + i * 0.13, 0.35, 0.16, 'triangle');
    });
    for (const f of [523, 659, 784]) tone(f, t + 0.55, 1.4, 0.1, 'triangle');
  },
};

/** Joue un effet (sauf s'il vient d'en être joué un, pour ne pas saturer quand les ordinateurs jouent vite). */
export function playSfx(sound: Sound) {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  if (sound === 'card' && now - lastPlay < 0.08) return;
  lastPlay = now;
  SOUNDS[sound](now + 0.01);
}
