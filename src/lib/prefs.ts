import { useSyncExternalStore } from 'react';
import { type Lang, detectLang } from '../../shared/i18n';

/**
 * Préférences de l'appareil (localStorage), partagées en direct entre les écrans.
 * Les clés reprennent celles déjà utilisées pour ne pas perdre les réglages existants.
 */

export type BotSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type MapTheme = 'auto' | 'day' | 'dusk';

export interface Prefs {
  claimAnim: boolean;
  introVoice: boolean;
  showClaimable: boolean;
  botSpeed: BotSpeed;
  colorBlind: boolean;
  sfx: boolean;
  mapTheme: MapTheme;
  lang: Lang;
}

const KEYS: Record<keyof Prefs, string> = {
  claimAnim: 'rdr.claimAnim',
  introVoice: 'rdr.introVoice',
  showClaimable: 'rdr.showClaimable',
  botSpeed: 'rdr.botSpeed',
  colorBlind: 'rdr.colorBlind',
  sfx: 'rdr.sfx',
  mapTheme: 'rdr.mapTheme',
  lang: 'rdr.lang',
};

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const DEFAULTS = (): Prefs => ({
  claimAnim: !reducedMotion(),
  introVoice: true,
  showClaimable: true,
  botSpeed: 'normal',
  colorBlind: false,
  sfx: true,
  mapTheme: 'auto',
  lang: detectLang(),
});

const BOT_SPEEDS: BotSpeed[] = ['slow', 'normal', 'fast', 'instant'];

function load(): Prefs {
  const prefs = DEFAULTS();
  try {
    const flag = (k: 'claimAnim' | 'introVoice' | 'showClaimable' | 'colorBlind' | 'sfx') => {
      const v = localStorage.getItem(KEYS[k]);
      if (v !== null) prefs[k] = v === '1';
    };
    flag('claimAnim');
    flag('introVoice');
    flag('showClaimable');
    flag('colorBlind');
    flag('sfx');
    const theme = localStorage.getItem(KEYS.mapTheme) as MapTheme | null;
    if (theme && ['auto', 'day', 'dusk'].includes(theme)) prefs.mapTheme = theme;
    const lang = localStorage.getItem(KEYS.lang);
    if (lang === 'fr' || lang === 'en') prefs.lang = lang;
    const speed = localStorage.getItem(KEYS.botSpeed) as BotSpeed | null;
    if (speed && BOT_SPEEDS.includes(speed)) prefs.botSpeed = speed;
  } catch {
    /* stockage indisponible : valeurs par défaut */
  }
  return prefs;
}

let current = load();
const listeners = new Set<() => void>();

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEYS[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  } catch {
    /* stockage indisponible : le réglage vaut pour cette visite */
  }
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** Lecture ponctuelle (hors composant React). */
export function getPref<K extends keyof Prefs>(key: K): Prefs[K] {
  return current[key];
}

export function usePref<K extends keyof Prefs>(key: K): Prefs[K] {
  return useSyncExternalStore(subscribe, () => current[key]);
}

/** Délai (ms) entre deux actions d'un ordinateur. */
export const BOT_DELAYS: Record<BotSpeed, number> = { slow: 1300, normal: 750, fast: 300, instant: 0 };
