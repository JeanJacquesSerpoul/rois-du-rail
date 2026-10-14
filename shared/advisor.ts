import { botAction, neededRoutes, pendingTickets, planPath } from './bot';
import { ROUTE_POINTS, cityName, computePayment, mapOf, routeName, ticketDone } from './engine';
import { type Lang, type T, cardsPhrase, makeT } from './i18n';
import type { MessageKey } from './i18n/fr';
import type { Action, CardColor, GameState, Route } from './types';

/**
 * Le chef de gare : conseiller pour les joueurs humains. Il s'appuie sur l'IA
 * « difficile » et n'utilise que ce que le joueur peut voir (sa main, ses billets,
 * la table), puis explique son conseil dans la langue de l'interface.
 */

export interface TicketStatus {
  id: number;
  label: string;
  points: number;
  state: 'done' | 'open' | 'blocked';
  /** Wagons encore à poser pour le réaliser (billets ouverts). */
  missing?: number;
}

export interface Advice {
  action: Action;
  headline: string;
  reasons: string[];
  warnings: string[];
  tickets: TicketStatus[];
  /** Éléments à mettre en évidence sur l'écran. */
  routeId?: number;
  cities: string[];
  marketIndex?: number;
  deck?: 'cards' | 'tickets';
}

/** Contexte de rédaction : partie, langue, traducteur. */
interface Ctx {
  s: GameState;
  seat: number;
  lang: Lang;
  t: T;
}

const ticketLabel = ({ s, lang }: Ctx, id: number) => {
  const map = mapOf(s);
  const ticket = map.ticketById[id];
  return `${cityName(map, ticket.a, lang)} → ${cityName(map, ticket.b, lang)}`;
};

export function ticketStatuses(s: GameState, seat: number, lang: Lang = 'fr'): TicketStatus[] {
  const ctx: Ctx = { s, seat, lang, t: makeT(lang) };
  return s.players[seat].tickets.map((id) => {
    const ticket = mapOf(s).ticketById[id];
    const base = { id, label: ticketLabel(ctx, id), points: ticket.points };
    if (ticketDone(s, seat, id)) return { ...base, state: 'done' as const };
    const plan = planPath(s, seat, ticket.a, ticket.b);
    return plan ? { ...base, state: 'open' as const, missing: plan.cost } : { ...base, state: 'blocked' as const };
  });
}

/** Billets en cours dont le trajet prévu passe par cette route. */
function ticketsUsing(s: GameState, seat: number, routeId: number): number[] {
  return pendingTickets(s, seat).filter((id) => {
    const ticket = mapOf(s).ticketById[id];
    return planPath(s, seat, ticket.a, ticket.b)?.routes.some((r) => r.id === routeId);
  });
}

/** Coût supplémentaire si la route nous échappe (Infinity : plus de chemin du tout). */
function detourCost(s: GameState, seat: number, routeId: number, ticketId: number): number {
  const ticket = mapOf(s).ticketById[ticketId];
  const base = planPath(s, seat, ticket.a, ticket.b);
  const alt = planPath(s, seat, ticket.a, ticket.b, { exclude: routeId });
  if (!base) return 0;
  return alt ? alt.cost - base.cost : Number.POSITIVE_INFINITY;
}

/** Route utile la plus prioritaire qui attend des cartes de cette couleur. */
function routeWanting(s: GameState, seat: number, color: CardColor): Route | undefined {
  const hand = s.players[seat].hand;
  return neededRoutes(s, seat, true)
    .filter((r) => r.color === color || r.color === 'gray')
    .sort((a, b) => b.length - a.length)
    .find((r) => r.color === 'gray' || hand[color] < r.length);
}

function explainClaim(ctx: Ctx, routeId: number, color: CardColor, advice: Advice) {
  const { s, seat, lang, t } = ctx;
  const map = mapOf(s);
  const route = map.routeById[routeId];
  const pay = computePayment(s.players[seat].hand, route, color);
  advice.routeId = routeId;
  advice.cities = [route.a, route.b];
  advice.headline = t('advice.claim', { route: routeName(map, route, lang) });
  if (pay) {
    const parts = [
      pay.colored ? cardsPhrase(t, lang, pay.color, pay.colored) : '',
      pay.locos ? cardsPhrase(t, lang, 'loco', pay.locos) : '',
    ].filter(Boolean);
    advice.reasons.push(t('advice.pay', { cards: parts.join(t('common.and')), pts: ROUTE_POINTS[route.length] }));
  }
  const users = ticketsUsing(s, seat, routeId);
  if (users.length) {
    advice.reasons.push(t('advice.serves', { n: users.length, tickets: users.map((id) => ticketLabel(ctx, id)).join(', ') }));
    const detour = Math.max(...users.map((id) => detourCost(s, seat, routeId, id)));
    if (detour === Number.POSITIVE_INFINITY) advice.reasons.push(t('advice.onlyWay'));
    else if (detour >= 2) advice.reasons.push(t('advice.detour', { n: detour }));
  } else if (route.length >= 4) {
    advice.reasons.push(t('advice.longRoute'));
  } else {
    advice.reasons.push(t('advice.network'));
  }
}

function explainCard(ctx: Ctx, action: Action, advice: Advice) {
  const { s, seat, lang, t } = ctx;
  const map = mapOf(s);
  const second = s.turn?.kind === 'draw';
  if (action.type === 'drawFaceUp') {
    const card = s.market[action.index]!;
    advice.marketIndex = action.index;
    if (card === 'loco') {
      advice.headline = t('advice.takeLoco');
      advice.reasons.push(t('advice.locoJoker'));
      advice.reasons.push(t('advice.locoTurn'));
      return;
    }
    advice.headline = t('advice.takeCard', { color: t(`card.${card}` as MessageKey) });
    const target = routeWanting(s, seat, card);
    if (target) {
      const missing = Math.max(1, target.length - s.players[seat].hand[card]);
      advice.cities = [target.a, target.b];
      advice.routeId = target.id;
      advice.reasons.push(
        target.color === 'gray'
          ? t('advice.grayRoute', { route: routeName(map, target, lang) })
          : t('advice.missing', { cards: cardsPhrase(t, lang, card, missing), route: routeName(map, target, lang) }),
      );
    } else {
      advice.reasons.push(t('advice.usefulCard'));
    }
  } else {
    advice.deck = 'cards';
    advice.headline = second ? t('advice.deckSecond') : t('advice.deck');
    advice.reasons.push(t('advice.blind'));
  }
  if (!second) advice.reasons.push(t('advice.thenSecond'));
}

function explainTickets(ctx: Ctx, keep: number[], offered: number[], advice: Advice) {
  const { s, seat, t } = ctx;
  const map = mapOf(s);
  advice.headline = t('advice.keep', { n: keep.length });
  advice.cities = [...new Set(keep.flatMap((id) => [map.ticketById[id].a, map.ticketById[id].b]))];
  const planned = new Set(neededRoutes(s, seat, true).map((r) => r.id));
  for (const id of offered) {
    const ticket = map.ticketById[id];
    const plan = planPath(s, seat, ticket.a, ticket.b, { planned });
    const cost = plan ? plan.cost : Number.POSITIVE_INFINITY;
    const label = `${ticketLabel(ctx, id)} (${ticket.points} pts)`;
    if (keep.includes(id)) {
      advice.reasons.push(cost === 0 ? t('advice.keepFree', { label }) : t('advice.keepCost', { label, n: cost }));
    } else {
      advice.reasons.push(
        cost === Number.POSITIVE_INFINITY
          ? t('advice.dropBlocked', { label })
          : t('advice.dropCost', { label, n: cost, pts: ticket.points }),
      );
    }
  }
}

export function advise(s: GameState, seat: number, lang: Lang = 'fr'): Advice {
  const t = makeT(lang);
  const ctx: Ctx = { s, seat, lang, t };
  // le conseil est celui que jouerait l'IA difficile à la place du joueur
  const asHard: GameState = { ...s, current: seat, players: s.players.map((p, i) => (i === seat ? { ...p, level: 'hard' } : p)) };
  const action = botAction(asHard);
  const me = s.players[seat];
  const advice: Advice = { action, headline: '', reasons: [], warnings: [], tickets: ticketStatuses(s, seat, lang), cities: [] };

  switch (action.type) {
    case 'claimRoute':
      explainClaim(ctx, action.routeId, action.color, advice);
      break;
    case 'drawFaceUp':
    case 'drawDeck':
      explainCard(ctx, action, advice);
      break;
    case 'drawTickets':
      advice.deck = 'tickets';
      advice.headline = t('advice.drawTickets');
      advice.reasons.push(t('advice.allDone', { n: me.wagons }));
      advice.reasons.push(t('advice.newTicket'));
      break;
    case 'keepTickets':
      if (s.turn?.kind === 'tickets') explainTickets(ctx, action.keep, s.turn.offered, advice);
      break;
    case 'pass':
      advice.headline = t('advice.pass');
      advice.reasons.push(t('advice.noMove'));
      break;
  }

  // mises en garde générales
  for (const ticket of advice.tickets) {
    if (ticket.state === 'blocked') advice.warnings.push(t('advice.warnBlocked', { label: ticket.label, pts: ticket.points }));
  }
  const missing = advice.tickets.reduce((n, ticket) => n + (ticket.missing ?? 0), 0);
  if (missing > me.wagons) advice.warnings.push(t('advice.warnWagons', { need: missing, n: me.wagons }));
  const rival = s.players
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== seat)
    .sort((a, b) => a.p.wagons - b.p.wagons)[0];
  if (s.lastRound) advice.warnings.push(t('advice.warnLast'));
  else if (rival && rival.p.wagons <= 8) advice.warnings.push(t('advice.warnEnd', { name: rival.p.name, n: rival.p.wagons }));
  return advice;
}
