/**
 * Musique d'ambiance originale, générée avec la Web Audio API (aucun fichier audio).
 * Une petite valse ferroviaire en do majeur : mélodie, basse, accords et « tchou-tchou » discret.
 */

const BPM = 104;
const BEAT = 60 / BPM;
const VOLUME = 0.16;
const STORAGE_KEY = 'rdr.music';

// Mélodie : [note MIDI | null pour un silence, durée en temps]
const MELODY: [number | null, number][] = [
  // A
  [76, 1], [79, 1], [84, 1], [79, 1],
  [81, 1.5], [79, 0.5], [76, 1], [72, 1],
  [77, 1], [81, 1], [84, 1.5], [81, 0.5],
  [79, 2], [74, 1], [71, 1],
  [76, 0.5], [77, 0.5], [79, 1], [76, 1], [72, 1],
  [71, 1], [76, 1], [79, 1.5], [77, 0.5],
  [81, 1], [77, 1], [79, 1], [83, 1],
  [84, 3], [null, 1],
  // B
  [81, 0.5], [79, 0.5], [77, 1], [81, 1], [84, 1],
  [86, 1.5], [84, 0.5], [83, 1], [79, 1],
  [79, 1], [76, 1], [71, 1], [76, 1],
  [84, 1.5], [83, 0.5], [81, 2],
  [77, 1], [81, 1], [86, 1], [81, 1],
  [83, 1], [79, 1], [74, 1], [77, 1],
  [76, 1], [79, 1], [84, 1], [88, 1],
  [84, 2], [null, 2],
];

// Un accord par mesure (notes MIDI), dans l'ordre des 16 mesures
const CHORDS: number[][] = [
  [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
  [60, 64, 67], [52, 55, 59], [53, 57, 60], [55, 59, 62],
  [53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64],
  [50, 53, 57], [55, 59, 62], [60, 64, 67], [60, 64, 67],
];

const LOOP_BEATS = CHORDS.length * 4;

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Voice = 'lead' | 'bass' | 'pad' | 'chug';
interface NoteEvent {
  beat: number;
  midi: number;
  dur: number;
  voice: Voice;
  gain: number;
}

function buildScore(): NoteEvent[] {
  const events: NoteEvent[] = [];
  let t = 0;
  for (const [midi, dur] of MELODY) {
    if (midi !== null) events.push({ beat: t, midi, dur, voice: 'lead', gain: 0.5 });
    t += dur;
  }
  CHORDS.forEach((chord, bar) => {
    const b = bar * 4;
    events.push({ beat: b, midi: chord[0] - 12, dur: 1.6, voice: 'bass', gain: 0.55 });
    events.push({ beat: b + 2, midi: chord[2] - 24, dur: 1.6, voice: 'bass', gain: 0.45 });
    for (const off of [1, 3]) for (const n of chord) events.push({ beat: b + off, midi: n, dur: 0.7, voice: 'pad', gain: 0.12 });
    // le rythme du train : accent sur chaque temps, petit coup sur les contretemps
    for (let i = 0; i < 8; i++) events.push({ beat: b + i / 2, midi: 0, dur: 0.15, voice: 'chug', gain: i % 2 ? 0.05 : 0.09 });
  });
  return events.sort((a, b) => a.beat - b.beat);
}

class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private score = buildScore();
  private timer: number | null = null;
  private startTime = 0;
  private nextIndex = 0;
  private loop = 0;
  private listeners = new Set<(on: boolean) => void>();
  playing = false;

  get wanted(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private setWanted(on: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* stockage indisponible */
    }
  }

  subscribe(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.playing);
  }

  private setup() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // un léger écho pour adoucir le son synthétique
    const delay = ctx.createDelay();
    delay.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    this.master.connect(ctx.destination);
    this.master.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.2);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (!this.playing) return;
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    return ctx;
  }

  private play(e: NoteEvent, when: number) {
    const ctx = this.ctx!;
    const dur = e.dur * BEAT;
    const env = ctx.createGain();
    env.connect(this.master!);
    if (e.voice === 'chug') {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
      src.connect(filter).connect(env);
      env.gain.setValueAtTime(e.gain, when);
      env.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.start(when);
      src.stop(when + dur + 0.02);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = e.voice === 'lead' ? 'triangle' : 'sine';
    osc.frequency.value = freq(e.midi);
    osc.connect(env);
    const attack = e.voice === 'pad' ? 0.04 : 0.01;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(e.gain, when + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(dur * 0.95, attack + 0.05));
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  /** Programme les notes à jouer dans la fenêtre à venir (planification « lookahead »). */
  private tick = () => {
    const ctx = this.ctx!;
    const horizon = ctx.currentTime + 0.25;
    while (true) {
      const e = this.score[this.nextIndex];
      const when = this.startTime + (this.loop * LOOP_BEATS + e.beat) * BEAT;
      if (when > horizon) break;
      if (when >= ctx.currentTime - 0.01) this.play(e, when);
      this.nextIndex += 1;
      if (this.nextIndex >= this.score.length) {
        this.nextIndex = 0;
        this.loop += 1;
      }
    }
  };

  async start() {
    const ctx = this.setup();
    await ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.setWanted(true);
    this.startTime = ctx.currentTime + 0.1;
    this.nextIndex = 0;
    this.loop = 0;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.4);
    this.timer = window.setInterval(this.tick, 50);
    this.tick();
    this.emit();
  }

  stop() {
    this.setWanted(false);
    if (!this.playing || !this.ctx) return;
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    this.master!.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => {
      if (!this.playing) void ctx.suspend();
    }, 800);
    this.emit();
  }

  toggle() {
    if (this.playing) this.stop();
    else void this.start();
  }
}

export const music = new MusicPlayer();

// Les navigateurs interdisent le son avant une interaction : si le joueur avait
// activé la musique, on la relance au premier contact avec la page.
if (typeof window !== 'undefined' && music.wanted) {
  const resume = (e: Event) => {
    // le bouton musique gère lui-même ce premier clic
    if ((e.target as Element | null)?.closest?.('[data-music-toggle]')) return;
    void music.start();
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
}
