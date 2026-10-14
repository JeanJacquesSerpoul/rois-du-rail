import {
  TRAIN_COLORS,
  claimStatus,
  computePayment,
  paymentOptions,
  routeBlockedByPair,
  ticketDone,
} from './engine';
import { ROUTES, ROUTE_BY_ID, TICKET_BY_ID } from './map';
import type { Action, BotLevel, CardColor, GameState, Route, TrainColor } from './types';

export const BOT_LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];
export const BOT_LEVEL_NAMES: Record<BotLevel, string> = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' };

/** Réglages du niveau difficile (exportés pour les simulations). */
export const HARD = {
  ticketMinWagons: 16,
  extraMaxCost: 6,
  extraMargin: 10,
  extraRatio: 1,
  critW: 1.5,
  longW: 3,
  adjBonus: 1.5,
  turnCost: 3,
  locoValue: 2.5,
};

const levelOf = (s: GameState, seat: number): BotLevel => s.players[seat].level ?? 'normal';

/** Hasard déterministe tiré de l'état de la partie (l'IA reste une fonction pure). */
function chance(s: GameState, salt: number): number {
  let h = (s.rng ^ Math.imul(s.eventSeq + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface PlanOptions {
  /** Route considérée comme indisponible (pour mesurer si elle est critique). */
  exclude?: number;
  /** Routes déjà prévues pour d'autres destinations : comptées gratuites pour mutualiser les trajets. */
  planned?: Set<number>;
  /** Surcoût par route à prendre : favorise les trajets en peu de routes longues (moins de tours). */
  turnCost?: number;
}

/**
 * Plus court chemin pour un joueur : ses routes coûtent 0, les routes libres
 * coûtent leur longueur, les routes adverses sont infranchissables.
 */
export function planPath(
  s: GameState,
  seat: number,
  from: string,
  to: string,
  opts: PlanOptions = {},
): { cost: number; routes: Route[] } | null {
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
      if (!other || done.has(other) || r.id === opts.exclude) continue;
      const owner = s.owners[r.id];
      let w: number;
      if (owner === seat) w = 0;
      else if (owner === undefined && !routeBlockedByPair(s, r, seat)) w = opts.planned?.has(r.id) ? 0 : r.length + (opts.turnCost ?? 0);
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

export function pendingTickets(s: GameState, seat: number): number[] {
  return s.players[seat].tickets.filter((id) => !ticketDone(s, seat, id));
}

/** Routes à prendre pour réaliser les destinations en cours. */
export function neededRoutes(s: GameState, seat: number, shared: boolean): Route[] {
  const need: Route[] = [];
  const planned = new Set<number>();
  // les plus gros billets d'abord : les petits viennent se greffer sur leur trajet
  const tickets = pendingTickets(s, seat).sort((a, b) => TICKET_BY_ID[b].points - TICKET_BY_ID[a].points);
  for (const id of tickets) {
    const t = TICKET_BY_ID[id];
    const plan = planPath(s, seat, t.a, t.b, shared ? { planned, turnCost: HARD.turnCost } : {});
    if (!plan) continue;
    const wagons = plan.routes.reduce((n, r) => n + (planned.has(r.id) ? 0 : r.length), 0);
    if (wagons > s.players[seat].wagons) continue;
    need.push(...plan.routes);
    for (const r of plan.routes) planned.add(r.id);
  }
  return need;
}

function bestPayment(s: GameState, seat: number, route: Route) {
  const opts = paymentOptions(s.players[seat].hand, route);
  // on préserve les locomotives au maximum
  return opts.sort((a, b) => a.locos - b.locos || b.colored - a.colored)[0];
}

function chooseTickets(s: GameState, seat: number, offered: number[], min: number): number[] {
  const level = levelOf(s, seat);
  const wagons = s.players[seat].wagons;
  const planned = new Set(level === 'hard' ? neededRoutes(s, seat, true).map((r) => r.id) : []);
  const scored = offered
    .map((id) => {
      const t = TICKET_BY_ID[id];
      const plan = planPath(s, seat, t.a, t.b, { planned });
      return { id, cost: plan ? plan.cost : Infinity, points: t.points };
    })
    .sort((a, b) => a.cost - b.cost || b.points - a.points);
  const keep = scored.slice(0, min).map((t) => t.id);
  if (level === 'easy') return keep;

  const committed = [...planned].reduce((n, id) => n + ROUTE_BY_ID[id].length, 0);
  let budget = wagons - committed - scored.slice(0, min).reduce((n, t) => n + (Number.isFinite(t.cost) ? t.cost : 0), 0);
  for (const t of scored.slice(min)) {
    const ok =
      level === 'hard'
        ? t.cost <= 2 || (t.cost <= Math.min(HARD.extraMaxCost, budget - HARD.extraMargin) && t.points >= t.cost * HARD.extraRatio)
        : t.cost <= Math.min(6, budget - 8);
    if (ok) {
      keep.push(t.id);
      budget -= t.cost;
    }
  }
  return keep;
}

function wantedColors(s: GameState, seat: number, need: Route[], weights?: Map<number, number>): Map<CardColor, number> {
  const hand = s.players[seat].hand;
  const want = new Map<CardColor, number>();
  for (const r of need) {
    const w = weights?.get(r.id) ?? 1;
    if (r.color === 'gray') {
      const c = TRAIN_COLORS.reduce<TrainColor>((b, c) => (hand[c] > hand[b] ? c : b), 'red');
      want.set(c, (want.get(c) ?? 0) + (w * r.length) / 2);
    } else {
      const missing = Math.max(0, r.length - hand[r.color]);
      if (missing > 0) want.set(r.color, (want.get(r.color) ?? 0) + w * (missing + r.length / 10));
    }
  }
  return want;
}

function freeRoutes(s: GameState, seat: number): Route[] {
  return ROUTES.filter((r) => claimStatus(s, seat, r.id) === 'ok').sort((a, b) => b.length - a.length);
}

function claim(s: GameState, seat: number, r: Route): Action {
  return { type: 'claimRoute', routeId: r.id, color: bestPayment(s, seat, r).color };
}

/** Fin de tour : rien à piocher → poser n'importe quoi, sinon destinations, sinon passer. */
function lastResort(s: GameState, seat: number): Action {
  const any = ROUTES.find((r) => claimStatus(s, seat, r.id) === 'ok');
  if (any) {
    const pay = computePayment(s.players[seat].hand, any, bestPayment(s, seat, any).color)!;
    return { type: 'claimRoute', routeId: any.id, color: pay.color };
  }
  if (s.ticketDeck.length > 0) return { type: 'drawTickets' };
  return { type: 'pass' };
}

function pickCard(s: GameState, want: Map<CardColor, number>, allowLoco: boolean, locoValue: number): Action {
  let bestIdx = -1;
  let bestScore = 0;
  s.market.forEach((c, i) => {
    if (!c) return;
    const score = c === 'loco' ? (allowLoco ? locoValue : 0) : (want.get(c) ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  if (bestIdx >= 0) return { type: 'drawFaceUp', index: bestIdx };
  if (s.deck.length + s.discard.length > 0) return { type: 'drawDeck' };
  const any = s.market.findIndex((c) => c && (allowLoco || c !== 'loco'));
  return any >= 0 ? { type: 'drawFaceUp', index: any } : { type: 'drawDeck' };
}

const canDraw = (s: GameState) => s.deck.length + s.discard.length > 0 || s.market.some((c) => c);

// ---------------------------------------------------------------- Facile

/** Joue sans vraie stratégie : pioche souvent au hasard et pose les petites routes. */
function easyAction(s: GameState, seat: number): Action {
  const need = neededRoutes(s, seat, false);
  const randomCard = (allowLoco: boolean): Action => {
    const visible = s.market.flatMap((c, i) => (c && (allowLoco || c !== 'loco') ? [i] : []));
    if (visible.length && (chance(s, 1) < 0.5 || s.deck.length + s.discard.length === 0))
      return { type: 'drawFaceUp', index: visible[Math.floor(chance(s, 2) * visible.length)] };
    return s.deck.length + s.discard.length > 0 ? { type: 'drawDeck' } : lastResort(s, seat);
  };
  if (s.turn?.kind === 'draw') return randomCard(false);

  const claimable = [...new Map(need.map((r) => [r.id, r])).values()]
    .filter((r) => claimStatus(s, seat, r.id) === 'ok')
    .sort((a, b) => a.length - b.length);
  if (claimable.length && (chance(s, 3) > 0.35 || s.lastRound)) return claim(s, seat, claimable[0]);

  if (need.length === 0 && chance(s, 4) < 0.5) {
    const free = freeRoutes(s, seat);
    if (free.length) return claim(s, seat, free[Math.floor(chance(s, 5) * free.length)]);
  }
  if (s.lastRound) {
    const free = freeRoutes(s, seat);
    if (free.length) return claim(s, seat, free[free.length - 1]);
  }
  return canDraw(s) ? randomCard(false) : lastResort(s, seat);
}

// ---------------------------------------------------------------- Normal

function normalAction(s: GameState, seat: number): Action {
  const me = s.players[seat];
  const need = neededRoutes(s, seat, false);
  const want = wantedColors(s, seat, need);
  const locoValue = need.length > 0 ? 1.5 : 0;

  if (s.turn?.kind === 'draw') return pickCard(s, want, false, locoValue);

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
    if (pay && (pay.locos === 0 || pay.locos <= r.length / 2 || r.length >= 4 || s.lastRound)) return claim(s, seat, r);
  }

  // 2. Plus d'objectif : nouvelles destinations si on a encore de la marge
  const enoughCards = TRAIN_COLORS.some((c) => me.hand[c] + me.hand.loco >= 4);
  if (need.length === 0) {
    if (!s.lastRound && me.wagons >= 14 && s.ticketDeck.length > 0 && s.players.every((p) => p.wagons > 10))
      return { type: 'drawTickets' };
    // sinon on rentabilise les wagons sur les routes longues
    const target = freeRoutes(s, seat).find((r) => r.length >= 3 || s.lastRound || me.wagons <= 4);
    if (target && (!enoughCards || target.length >= 3 || s.lastRound)) return claim(s, seat, target);
  }

  // 3. Fin de partie : on pose ce qu'on peut
  if (s.lastRound) {
    const free = freeRoutes(s, seat);
    if (free[0]) return claim(s, seat, free[0]);
  }

  // 4. Piocher des cartes
  return canDraw(s) ? pickCard(s, want, true, locoValue) : lastResort(s, seat);
}

// ---------------------------------------------------------------- Difficile

/**
 * Mutualise les trajets de ses destinations, prend d'abord les routes critiques
 * (sans détour possible), anticipe la fin de partie et allonge son réseau.
 */
function hardAction(s: GameState, seat: number): Action {
  const me = s.players[seat];
  const need = neededRoutes(s, seat, true);
  const endNear = !!s.lastRound || me.wagons <= 8 || s.players.some((p, i) => i !== seat && p.wagons <= 7);

  // priorité de chaque route utile : longueur, partage entre billets et absence d'alternative
  const counts = new Map<number, number>();
  for (const r of need) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
  const priority = new Map<number, number>();
  const pending = pendingTickets(s, seat);
  for (const id of counts.keys()) {
    let critical = 0;
    for (const tid of pending) {
      const t = TICKET_BY_ID[tid];
      const base = planPath(s, seat, t.a, t.b);
      if (!base || !base.routes.some((r) => r.id === id)) continue;
      const alt = planPath(s, seat, t.a, t.b, { exclude: id });
      critical += alt ? Math.min(8, alt.cost - base.cost) : 10;
    }
    priority.set(id, ROUTE_BY_ID[id].length * HARD.longW + counts.get(id)! * 2 + critical * HARD.critW);
  }
  const want = wantedColors(s, seat, need, priority);
  const locoValue = need.length > 0 ? HARD.locoValue : 0;

  if (s.turn?.kind === 'draw') return pickCard(s, want, false, locoValue);

  // 1. Routes utiles, des plus urgentes aux moins urgentes
  const claimable = [...priority.keys()]
    .map((id) => ROUTE_BY_ID[id])
    .filter((r) => claimStatus(s, seat, r.id) === 'ok')
    .sort((a, b) => priority.get(b.id)! - priority.get(a.id)!);
  for (const r of claimable) {
    const pay = bestPayment(s, seat, r);
    const urgent = priority.get(r.id)! >= 12 || endNear;
    if (pay && (pay.locos === 0 || pay.locos <= r.length / 2 || r.length >= 4 || urgent)) return claim(s, seat, r);
  }

  // 2. Destinations terminées : en reprendre tant qu'il reste du temps
  if (need.length === 0 && !endNear && me.wagons >= HARD.ticketMinWagons && s.ticketDeck.length > 0) return { type: 'drawTickets' };

  // 3. Sinon, maximiser les points : routes longues, de préférence collées à notre réseau
  if (need.length === 0 || s.lastRound) {
    const myCities = new Set(ROUTES.filter((r) => s.owners[r.id] === seat).flatMap((r) => [r.a, r.b]));
    const free = freeRoutes(s, seat).sort(
      (a, b) =>
        b.length +
        (myCities.has(b.a) || myCities.has(b.b) ? HARD.adjBonus : 0) -
        (a.length + (myCities.has(a.a) || myCities.has(a.b) ? HARD.adjBonus : 0)),
    );
    const target = free.find((r) => r.length >= 3 || endNear);
    if (target) return claim(s, seat, target);
  }

  // 4. Piocher en visant les couleurs des routes prioritaires
  return canDraw(s) ? pickCard(s, want, true, locoValue) : lastResort(s, seat);
}

export function botAction(s: GameState): Action {
  const seat = s.current;
  const turn = s.turn;
  if (turn?.kind === 'tickets') return { type: 'keepTickets', keep: chooseTickets(s, seat, turn.offered, turn.min) };
  switch (levelOf(s, seat)) {
    case 'easy':
      return easyAction(s, seat);
    case 'hard':
      return hardAction(s, seat);
    default:
      return normalAction(s, seat);
  }
}
