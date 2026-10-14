import { useEffect, useMemo } from 'react';
import { cityName, mapOf } from '../../shared/engine';
import { type Lang, type T, cardsPhrase, makeT } from '../../shared/i18n';
import type { MessageKey } from '../../shared/i18n/fr';
import type { GameEvent, GameState } from '../../shared/types';
import { getPref, usePref } from './prefs';

/** Traducteur de l'interface, dans la langue choisie (réglages) ou celle du navigateur. */
export function useT(): { t: T; lang: Lang } {
  const lang = usePref('lang');
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return useMemo(() => ({ t: makeT(lang), lang }), [lang]);
}

/** Traducteur hors composant (messages ponctuels). */
export const currentT = (): T => makeT(getPref('lang'));

/** Texte d'un événement de partie, dans la langue de l'interface. */
export function formatEvent(e: GameEvent, s: GameState, t: T, lang: Lang): string {
  const name = s.players[e.seat]?.name ?? '';
  const map = mapOf(s);
  switch (e.kind) {
    case 'drawFaceUp':
      return t('event.drawFaceUp', { name, card: t(`card.${e.card ?? 'loco'}` as MessageKey) });
    case 'drawDeck':
      return t('event.drawDeck', { name });
    case 'claimRoute': {
      const r = e.routeId !== undefined ? map.routeById[e.routeId] : undefined;
      if (!r) return e.text;
      const route = `${cityName(map, r.a, lang)} – ${cityName(map, r.b, lang)}`;
      return t('event.claimRoute', { name, route, pts: [0, 1, 2, 4, 7, 10, 15][r.length] });
    }
    case 'drawTickets':
      return t('event.drawTickets', { name });
    case 'keepTickets':
      return t('event.keepTickets', { name, n: e.count ?? 1 });
    case 'pass':
      return t('event.pass', { name });
    case 'lastRound':
      return t('event.lastRound', { name, n: e.count ?? s.players[e.seat]?.wagons ?? 2 });
    case 'end':
      return t('event.end', { name });
    default:
      return e.text;
  }
}

export { cardsPhrase };

/** Message d'erreur dans la langue de l'interface (si l'erreur porte un code connu). */
export function errorText(e: unknown, t: T): string {
  const code = (e as { code?: string })?.code;
  const key = `error.${code}` as MessageKey;
  if (code) {
    const msg = t(key);
    if (msg !== key) return msg;
  }
  return (e as Error)?.message ?? String(e);
}
