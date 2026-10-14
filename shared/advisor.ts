import { botAction, neededRoutes, pendingTickets, planPath } from './bot';
import { ROUTE_POINTS, computePayment, routeName, ticketDone } from './engine';
import { CITY_BY_ID, ROUTE_BY_ID, TICKET_BY_ID } from './map';
import type { Action, CardColor, GameState, Route } from './types';

/**
 * Le chef de gare : conseiller pour les joueurs humains. Il s'appuie sur l'IA
 * « difficile » et n'utilise que ce que le joueur peut voir (sa main, ses billets,
 * la table), puis explique son conseil en français.
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

const ticketLabel = (id: number) => {
  const t = TICKET_BY_ID[id];
  return `${CITY_BY_ID[t.a].name} → ${CITY_BY_ID[t.b].name}`;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Couleurs accordées avec « carte » (féminin). */
const CARD_ADJ: Record<CardColor, string> = {
  red: 'rouge',
  orange: 'orange',
  yellow: 'jaune',
  green: 'verte',
  blue: 'bleue',
  purple: 'violette',
  black: 'noire',
  white: 'blanche',
  loco: 'locomotive',
};

function cardsPhrase(color: CardColor, n: number): string {
  if (color === 'loco') return plural(n, 'locomotive');
  // « orange » est invariable, les autres couleurs prennent un s au pluriel
  return `${plural(n, 'carte')} ${CARD_ADJ[color]}${n > 1 && color !== 'orange' ? 's' : ''}`;
}

export function ticketStatuses(s: GameState, seat: number): TicketStatus[] {
  return s.players[seat].tickets.map((id) => {
    const t = TICKET_BY_ID[id];
    const base = { id, label: ticketLabel(id), points: t.points };
    if (ticketDone(s, seat, id)) return { ...base, state: 'done' as const };
    const plan = planPath(s, seat, t.a, t.b);
    return plan ? { ...base, state: 'open' as const, missing: plan.cost } : { ...base, state: 'blocked' as const };
  });
}

/** Billets en cours dont le trajet prévu passe par cette route. */
function ticketsUsing(s: GameState, seat: number, routeId: number): number[] {
  return pendingTickets(s, seat).filter((id) => {
    const t = TICKET_BY_ID[id];
    return planPath(s, seat, t.a, t.b)?.routes.some((r) => r.id === routeId);
  });
}

/** Coût supplémentaire si la route nous échappe (Infinity : plus de chemin du tout). */
function detourCost(s: GameState, seat: number, routeId: number, ticketId: number): number {
  const t = TICKET_BY_ID[ticketId];
  const base = planPath(s, seat, t.a, t.b);
  const alt = planPath(s, seat, t.a, t.b, { exclude: routeId });
  if (!base) return 0;
  return alt ? alt.cost - base.cost : Infinity;
}

/** Route utile la plus prioritaire qui attend des cartes de cette couleur. */
function routeWanting(s: GameState, seat: number, color: CardColor): Route | undefined {
  const hand = s.players[seat].hand;
  return neededRoutes(s, seat, true)
    .filter((r) => r.color === color || r.color === 'gray')
    .sort((a, b) => b.length - a.length)
    .find((r) => r.color === 'gray' || hand[color] < r.length);
}

function explainClaim(s: GameState, seat: number, routeId: number, color: CardColor, advice: Advice) {
  const route = ROUTE_BY_ID[routeId];
  const pay = computePayment(s.players[seat].hand, route, color);
  advice.routeId = routeId;
  advice.cities = [route.a, route.b];
  advice.headline = `Prenez la route ${routeName(route)}`;
  if (pay) {
    const parts = [pay.colored ? cardsPhrase(pay.color, pay.colored) : '', pay.locos ? cardsPhrase('loco', pay.locos) : ''].filter(Boolean);
    advice.reasons.push(`Payez avec ${parts.join(' et ')} : +${ROUTE_POINTS[route.length]} points.`);
  }
  const users = ticketsUsing(s, seat, routeId);
  if (users.length) {
    advice.reasons.push(`Elle sert ${users.length > 1 ? 'à vos billets' : 'à votre billet'} ${users.map(ticketLabel).join(', ')}.`);
    const detour = Math.max(...users.map((id) => detourCost(s, seat, routeId, id)));
    if (detour === Infinity) advice.reasons.push('C’est le seul passage possible : si un adversaire la prend, le billet sera perdu.');
    else if (detour >= 2) advice.reasons.push(`Sans elle, le détour coûterait ${plural(detour, 'wagon')} de plus.`);
  } else if (route.length >= 4) {
    advice.reasons.push('Les routes longues rapportent beaucoup de points par wagon posé.');
  } else {
    advice.reasons.push('Elle allonge votre réseau, utile pour le bonus du plus long trajet.');
  }
}

function explainCard(s: GameState, seat: number, action: Action, advice: Advice) {
  const second = s.turn?.kind === 'draw';
  if (action.type === 'drawFaceUp') {
    const card = s.market[action.index]!;
    advice.marketIndex = action.index;
    if (card === 'loco') {
      advice.headline = 'Prenez la locomotive visible';
      advice.reasons.push('Elle remplace n’importe quelle couleur, idéale pour finir une route.');
      advice.reasons.push('Attention : une locomotive visible compte pour vos deux cartes du tour.');
      return;
    }
    advice.headline = `Prenez la carte ${CARD_ADJ[card]} visible`;
    const target = routeWanting(s, seat, card);
    if (target) {
      const missing = Math.max(1, target.length - s.players[seat].hand[card]);
      advice.cities = [target.a, target.b];
      advice.routeId = target.id;
      advice.reasons.push(
        target.color === 'gray'
          ? `Elle complète votre plus grosse couleur pour la route grise ${routeName(target)}.`
          : `Il vous manque ${cardsPhrase(card, missing)} pour ${routeName(target)}.`,
      );
    } else {
      advice.reasons.push('C’est la carte visible la plus utile pour vos prochaines routes.');
    }
  } else {
    advice.deck = 'cards';
    advice.headline = second ? 'Piochez votre seconde carte dans la pioche' : 'Piochez dans la pioche';
    advice.reasons.push('Aucune carte visible ne fait avancer vos routes : tentez votre chance à l’aveugle.');
  }
  if (!second) advice.reasons.push('Vous pourrez ensuite prendre une seconde carte.');
}

function explainTickets(s: GameState, seat: number, keep: number[], offered: number[], advice: Advice) {
  advice.headline = `Gardez ${plural(keep.length, 'destination')}`;
  advice.cities = [...new Set(keep.flatMap((id) => [TICKET_BY_ID[id].a, TICKET_BY_ID[id].b]))];
  const planned = new Set(neededRoutes(s, seat, true).map((r) => r.id));
  for (const id of offered) {
    const t = TICKET_BY_ID[id];
    const plan = planPath(s, seat, t.a, t.b, { planned });
    const cost = plan ? plan.cost : Infinity;
    const label = `${ticketLabel(id)} (${t.points} pts)`;
    if (keep.includes(id)) {
      advice.reasons.push(
        cost === 0
          ? `✓ ${label} : déjà presque relié par vos trajets prévus.`
          : `✓ ${label} : environ ${plural(cost, 'wagon')} à poser.`,
      );
    } else {
      advice.reasons.push(
        cost === Infinity
          ? `✗ ${label} : plus réalisable, des routes sont déjà prises.`
          : `✗ ${label} : trop coûteux (${plural(cost, 'wagon')}) pour le risque de perdre ${t.points} points.`,
      );
    }
  }
}

export function advise(s: GameState, seat: number): Advice {
  // le conseil est celui que jouerait l'IA difficile à la place du joueur
  const asHard: GameState = { ...s, current: seat, players: s.players.map((p, i) => (i === seat ? { ...p, level: 'hard' } : p)) };
  const action = botAction(asHard);
  const me = s.players[seat];
  const advice: Advice = { action, headline: '', reasons: [], warnings: [], tickets: ticketStatuses(s, seat), cities: [] };

  switch (action.type) {
    case 'claimRoute':
      explainClaim(s, seat, action.routeId, action.color, advice);
      break;
    case 'drawFaceUp':
    case 'drawDeck':
      explainCard(s, seat, action, advice);
      break;
    case 'drawTickets':
      advice.deck = 'tickets';
      advice.headline = 'Piochez de nouvelles destinations';
      advice.reasons.push(`Vos billets sont réalisés et il vous reste ${plural(me.wagons, 'wagon')}.`);
      advice.reasons.push('Un nouveau billet bien choisi rapporte plus qu’une route isolée.');
      break;
    case 'keepTickets':
      if (s.turn?.kind === 'tickets') explainTickets(s, seat, action.keep, s.turn.offered, advice);
      break;
    case 'pass':
      advice.headline = 'Passez votre tour';
      advice.reasons.push('Aucun coup n’est possible pour le moment.');
      break;
  }

  // mises en garde générales
  for (const t of advice.tickets) {
    if (t.state === 'blocked') advice.warnings.push(`Le billet ${t.label} n’est plus réalisable : il vous coûtera ${t.points} points.`);
  }
  const missing = advice.tickets.reduce((n, t) => n + (t.missing ?? 0), 0);
  if (missing > me.wagons) advice.warnings.push(`Vos billets demandent environ ${missing} wagons, il ne vous en reste que ${me.wagons}.`);
  const rival = s.players
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== seat)
    .sort((a, b) => a.p.wagons - b.p.wagons)[0];
  if (s.lastRound) advice.warnings.push('C’est le dernier tour : marquez un maximum de points maintenant.');
  else if (rival && rival.p.wagons <= 8)
    advice.warnings.push(`${rival.p.name} n’a plus que ${plural(rival.p.wagons, 'wagon')} : la fin de partie approche.`);
  return advice;
}
