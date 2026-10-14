import {
  TRAIN_COLORS,
  claimStatus,
  computePayment,
  paymentOptions,
  routeBlockedByPair,
  ticketDone,
} from './engine';
import { ROUTES, ROUTE_BY_ID, TICKET_BY_ID } from './map';
import type { Action, CardColor, GameState, Route, TrainColor } from './types';

/**
 * Plus court chemin pour un joueur : ses routes coûtent 0, les routes libres
 * coûtent leur longueur, les routes adverses sont infranchissables.
 */
function planPath(s: GameState, seat: number, from: string, to: string): { cost: number; routes: Route[] } | null {
  const dist = new Map<string, number>([[from, 0]]);
  const via = new Map<string, Route>();
  const done = new Set<string>();
  while (true) {
    let best: string | null = null;
    for (const [c, d] of dist) if (!done.has(c) && (best === null || d < dist.get(best)!)) best = c;
    if (best === null) return null;
    if (best === to) break;
    done.add(best);
    for (const r of ROUTES) {
      const other = r.a === best ? r.b : r.b === best ? r.a : null;
      if (!other || done.has(other)) continue;
      const owner = s.owners[r.id];
      let w: number;
      if (owner === seat) w = 0;
      else if (owner === undefined && !routeBlockedByPair(s, r, seat)) w = r.length;
      else continue;
      const d = dist.get(best)! + w;
      if (!dist.has(other) || d < dist.get(other)!) {
        dist.set(other, d);
        via.set(other, r);
      }
    }
  }
  const routes: Route[] = [];
  let cur = to;
  while (cur !== from) {
    const r = via.get(cur)!;
    if (s.owners[r.id] !== seat) routes.push(r);
    cur = r.a === cur ? r.b : r.a;
  }
  return { cost: dist.get(to)!, routes };
}

function neededRoutes(s: GameState, seat: number): Route[] {
  const need: Route[] = [];
  for (const id of s.players[seat].tickets) {
    if (ticketDone(s, seat, id)) continue;
    const t = TICKET_BY_ID[id];
    const plan = planPath(s, seat, t.a, t.b);
    if (plan && plan.cost <= s.players[seat].wagons) need.push(...plan.routes);
  }
  return need;
}

function bestPayment(s: GameState, seat: number, route: Route) {
  const opts = paymentOptions(s.players[seat].hand, route);
  // on préserve les locomotives au maximum
  return opts.sort((a, b) => a.locos - b.locos || b.colored - a.colored)[0];
}

function chooseTickets(s: GameState, seat: number, offered: number[], min: number): number[] {
  const wagons = s.players[seat].wagons;
  const scored = offered
    .map((id) => {
      const t = TICKET_BY_ID[id];
      const plan = planPath(s, seat, t.a, t.b);
      return { id, cost: plan ? plan.cost : Infinity, points: t.points };
    })
    .sort((a, b) => a.cost - b.cost || b.points - a.points);
  const keep = scored.slice(0, min).map((t) => t.id);
  let budget = wagons - scored.slice(0, min).reduce((n, t) => n + (Number.isFinite(t.cost) ? t.cost : 0), 0);
  for (const t of scored.slice(min)) {
    if (t.cost <= Math.min(6, budget - 8)) {
      keep.push(t.id);
      budget -= t.cost;
    }
  }
  return keep;
}

function wantedColors(s: GameState, seat: number, need: Route[]): Map<CardColor, number> {
  const hand = s.players[seat].hand;
  const want = new Map<CardColor, number>();
  for (const r of need) {
    if (r.color === 'gray') {
      const c = TRAIN_COLORS.reduce<TrainColor>((b, c) => (hand[c] > hand[b] ? c : b), 'red');
      want.set(c, (want.get(c) ?? 0) + r.length / 2);
    } else {
      const missing = Math.max(0, r.length - hand[r.color]);
      if (missing > 0) want.set(r.color, (want.get(r.color) ?? 0) + missing + r.length / 10);
    }
  }
  return want;
}

export function botAction(s: GameState): Action {
  const seat = s.current;
  const me = s.players[seat];
  const turn = s.turn;

  if (turn?.kind === 'tickets') return { type: 'keepTickets', keep: chooseTickets(s, seat, turn.offered, turn.min) };

  const need = neededRoutes(s, seat);
  const want = wantedColors(s, seat, need);
  const pickCard = (allowLoco: boolean): Action => {
    let bestIdx = -1;
    let bestScore = 0;
    s.market.forEach((c, i) => {
      if (!c) return;
      const score = c === 'loco' ? (allowLoco && need.length > 0 ? 1.5 : 0) : (want.get(c) ?? 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) return { type: 'drawFaceUp', index: bestIdx };
    if (s.deck.length + s.discard.length > 0) return { type: 'drawDeck' };
    const any = s.market.findIndex((c) => c && (allowLoco || c !== 'loco'));
    return any >= 0 ? { type: 'drawFaceUp', index: any } : { type: 'drawDeck' };
  };

  if (turn?.kind === 'draw') return pickCard(false);

  // 1. Prendre une route utile à nos destinations, en priorité les plus longues
  const counts = new Map<number, number>();
  for (const r of need) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
  const claimable = [...counts.keys()]
    .map((id) => ROUTE_BY_ID[id])
    .filter((r) => claimStatus(s, seat, r.id) === 'ok')
    .sort((a, b) => b.length - a.length || counts.get(b.id)! - counts.get(a.id)!);
  for (const r of claimable) {
    const pay = bestPayment(s, seat, r);
    // évite de brûler toutes ses locomotives sur une petite route
    if (pay && (pay.locos === 0 || pay.locos <= r.length / 2 || r.length >= 4 || s.lastRound))
      return { type: 'claimRoute', routeId: r.id, color: pay.color };
  }

  // 2. Plus d'objectif : nouvelles destinations si on a encore de la marge
  const enoughCards = TRAIN_COLORS.some((c) => me.hand[c] + me.hand.loco >= 4);
  if (need.length === 0) {
    if (!s.lastRound && me.wagons >= 14 && s.ticketDeck.length > 0 && s.players.every((p) => p.wagons > 10))
      return { type: 'drawTickets' };
    // sinon on rentabilise les wagons sur les routes longues
    const free = ROUTES.filter((r) => claimStatus(s, seat, r.id) === 'ok').sort((a, b) => b.length - a.length);
    const target = free.find((r) => r.length >= 3 || s.lastRound || me.wagons <= 4);
    if (target && (!enoughCards || target.length >= 3 || s.lastRound)) {
      const pay = bestPayment(s, seat, target);
      if (pay) return { type: 'claimRoute', routeId: target.id, color: pay.color };
    }
  }

  // 3. Fin de partie : on pose ce qu'on peut
  if (s.lastRound) {
    const free = ROUTES.filter((r) => claimStatus(s, seat, r.id) === 'ok').sort((a, b) => b.length - a.length);
    if (free[0]) return { type: 'claimRoute', routeId: free[0].id, color: bestPayment(s, seat, free[0]).color };
  }

  // 4. Piocher des cartes
  if (s.deck.length + s.discard.length > 0 || s.market.some((c) => c)) return pickCard(true);

  // 5. Rien à piocher : poser n'importe quelle route, sinon destinations, sinon passer
  const any = ROUTES.find((r) => claimStatus(s, seat, r.id) === 'ok');
  if (any) {
    const pay = computePayment(me.hand, any, bestPayment(s, seat, any).color)!;
    return { type: 'claimRoute', routeId: any.id, color: pay.color };
  }
  if (s.ticketDeck.length > 0) return { type: 'drawTickets' };
  return { type: 'pass' };
}
