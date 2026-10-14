import type { CardColor, RouteColor } from '../types';
import { en } from './en';
import { fr, type MessageKey } from './fr';

/**
 * Traductions (français, anglais). Les messages sont des chaînes avec paramètres
 * `{nom}` ; une forme « singulier|pluriel » est choisie selon le paramètre `n`.
 */

export type Lang = 'fr' | 'en';
export const LANGS: Lang[] = ['fr', 'en'];
export type { MessageKey };
export type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<MessageKey, string>> = { fr, en };

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  let s = DICTS[lang][key] ?? fr[key] ?? key;
  if (s.includes('|') && typeof params?.n === 'number') {
    const [one, other] = s.split('|');
    // français : 0 et 1 au singulier ; anglais : 1 seul au singulier
    s = (lang === 'fr' ? params.n > 1 : params.n !== 1) ? other : one;
  }
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (params?.[k] !== undefined ? String(params[k]) : m));
}

export type T = (key: MessageKey, params?: Params) => string;

export const makeT =
  (lang: Lang): T =>
  (key, params) =>
    translate(lang, key, params);

/** Nom d'une couleur de route (« rouge », « gris »…). */
export const colorName = (t: T, c: RouteColor | CardColor) => t(`color.${c}` as MessageKey);

/** « 3 cartes rouges », « 1 locomotive », « 2 red cards »… */
export function cardsPhrase(t: T, lang: Lang, color: CardColor, n: number): string {
  if (color === 'loco') return t('cards.loco', { n });
  let adj = t(`card.${color}` as MessageKey);
  if (lang === 'fr' && n > 1 && color !== 'orange') adj += 's';
  return t('cards.colored', { n, color: adj });
}

/** Langue proposée par défaut : celle du navigateur si on la connaît. */
export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
  return nav?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
