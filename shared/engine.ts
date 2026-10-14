import { CITY_BY_ID, ROUTES, ROUTE_BY_ID, TICKETS, TICKET_BY_ID } from './map';
import type {
  Action,
  CardColor,
  GameEvent,
  GameState,
  Hand,
  PlayerConfig,
  PlayerResult,
  Route,
  TrainColor,
} from './types';

export const TRAIN_COLORS: TrainColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
export const CARD_COLORS: CardColor[] = [...TRAIN_COLORS, 'loco'];
export const WAGONS_PER_PLAYER = 45;
export const ROUTE_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };
export const LONGEST_BONUS = 10;
export const MARKET_SIZE = 5;

export const COLOR_NAMES: Record<CardColor | 'gray', string> = {
  red: 'rouge',
  orange: 'orange',
  yellow: 'jaune',
  green: 'vert',
  blue: 'bleu',
  purple: 'violet',
  black: 'noir',
  white: 'blanc',
  loco: 'locomotive',
  gray: 'gris',
};

/** Couleurs accordées avec « carte » (féminin). */
export const CARD_ADJ: Record<CardColor, string> = {
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

export class GameError extends Error {}

function fail(msg: string): never {
  throw new GameError(msg);
}

// ---------------------------------------------------------------- aléatoire

function random(s: GameState): number {
  // mulberry32 : générateur déterministe, l'état est stocké dans la partie
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- utilitaires

export function emptyHand(): Hand {
  return { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0, black: 0, white: 0, loco: 0 };
}

export function handSize(h: Hand): number {
  return CARD_COLORS.reduce((n, c) => n + h[c], 0);
}

export function routeName(r: Route): string {
  return `${CITY_BY_ID[r.a].name} – ${CITY_BY_ID[r.b].name}`;
}

function pushEvent(s: GameState, e: Omit<GameEvent, 'seq'>) {
  s.eventSeq += 1;
  s.events.push({ ...e, seq: s.eventSeq });
  if (s.events.length > 80) s.events.splice(0, s.events.length - 80);
}

function drawFromDeck(s: GameState): CardColor | null {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s, s.discard);
    s.discard = [];
  }
  return s.deck.pop() ?? null;
}

function refillMarket(s: GameState) {
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = 0; i < MARKET_SIZE; i++) if (s.market[i] === null) s.market[i] = drawFromDeck(s);
    const locos = s.market.filter((c) => c === 'loco').length;
    // Trois locomotives visibles : on défausse tout et on retourne 5 nouvelles cartes
    // (sauf s'il ne reste quasiment que des locomotives, pour éviter une boucle infinie).
    const nonLocoLeft = [...s.deck, ...s.discard].filter((c) => c !== 'loco').length;
    if (locos < 3 || nonLocoLeft < 3) return;
    for (let i = 0; i < MARKET_SIZE; i++) {
      const c = s.market[i];
      if (c) s.discard.push(c);
      s.market[i] = null;
    }
  }
}

function drawTicketsFromDeck(s: GameState, n: number): number[] {
  return s.ticketDeck.splice(0, n);
}

// ---------------------------------------------------------------- création

export function createGame(configs: PlayerConfig[], seed = Date.now()): GameState {
  if (configs.length < 2 || configs.length > 5) fail('Il faut entre 2 et 5 joueurs.');
  const s: GameState = {
    version: 1,
    rng: seed | 0,
    phase: 'setup',
    players: configs.map((c) => ({ ...c, hand: emptyHand(), tickets: [], wagons: WAGONS_PER_PLAYER, routePoints: 0 })),
    current: 0,
    turn: null,
    deck: [],
    discard: [],
    market: Array(MARKET_SIZE).fill(null),
    ticketDeck: [],
    owners: {},
    lastRound: null,
    consecutivePasses: 0,
    turnNumber: 1,
    events: [],
    eventSeq: 0,
    results: null,
  };
  for (const c of TRAIN_COLORS) for (let i = 0; i < 12; i++) s.deck.push(c);
  for (let i = 0; i < 14; i++) s.deck.push('loco');
  shuffle(s, s.deck);
  s.ticketDeck = shuffle(s, TICKETS.map((t) => t.id));
  for (const p of s.players) {
    for (let i = 0; i < 4; i++) p.hand[drawFromDeck(s)!] += 1;
  }
  refillMarket(s);
  s.turn = { kind: 'tickets', offered: drawTicketsFromDeck(s, 3), min: 2 };
  return s;
}

// ---------------------------------------------------------------- règles des routes

/** Les routes doubles ne sont utilisables toutes les deux qu'à partir de 4 joueurs. */
export function routeBlockedByPair(s: GameState, route: Route, seat: number): boolean {
  if (route.pair === undefined) return false;
  const pairOwner = s.owners[route.pair];
  if (pairOwner === undefined) return false;
  return s.players.length < 4 || pairOwner === seat;
}

export interface Payment {
  color: CardColor;
  colored: number;
  locos: number;
}

/** Calcule le paiement d'une route avec une couleur donnée (cartes de la couleur d'abord, puis locomotives). */
export function computePayment(hand: Hand, route: Route, color: CardColor): Payment | null {
  if (color !== 'loco' && route.color !== 'gray' && route.color !== color) return null;
  if (color === 'loco') return hand.loco >= route.length ? { color, colored: 0, locos: route.length } : null;
  const colored = Math.min(hand[color], route.length);
  const locos = route.length - colored;
  if (colored === 0 || locos > hand.loco) return null;
  return { color, colored, locos };
}

export function paymentOptions(hand: Hand, route: Route): Payment[] {
  const colors: CardColor[] = route.color === 'gray' ? [...TRAIN_COLORS, 'loco'] : [route.color, 'loco'];
  return colors.map((c) => computePayment(hand, route, c)).filter((p): p is Payment => p !== null);
}

export type ClaimStatus = 'ok' | 'owned' | 'pair' | 'wagons' | 'cards' | 'notYourTurn';

export function claimStatus(s: GameState, seat: number, routeId: number): ClaimStatus {
  const route = ROUTE_BY_ID[routeId];
  if (s.phase !== 'playing' || s.current !== seat || s.turn !== null) return 'notYourTurn';
  if (s.owners[routeId] !== undefined) return 'owned';
  if (routeBlockedByPair(s, route, seat)) return 'pair';
  if (s.players[seat].wagons < route.length) return 'wagons';
  if (paymentOptions(s.players[seat].hand, route).length === 0) return 'cards';
  return 'ok';
}

// ---------------------------------------------------------------- réseau d'un joueur

function playerRoutes(s: GameState, seat: number): Route[] {
  return ROUTES.filter((r) => s.owners[r.id] === seat);
}

export function connectedComponents(s: GameState, seat: number): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x)!;
    while (p !== parent.get(p)) p = parent.get(p)!;
    parent.set(x, p);
    return p;
  };
  for (const r of playerRoutes(s, seat)) parent.set(find(r.a), find(r.b));
  for (const k of [...parent.keys()]) find(k);
  return parent;
}

export function ticketDone(s: GameState, seat: number, ticketId: number): boolean {
  const t = TICKET_BY_ID[ticketId];
  const comp = connectedComponents(s, seat);
  const root = (x: string) => {
    let p = comp.get(x);
    if (p === undefined) return undefined;
    while (comp.get(p) !== p) p = comp.get(p)!;
    return p;
  };
  const ra = root(t.a);
  return ra !== undefined && ra === root(t.b);
}

/** Plus long chemin continu (chaque route utilisée une seule fois, les villes peuvent être revisitées). */
export function longestPath(s: GameState, seat: number): number {
  const routes = playerRoutes(s, seat);
  const adj = new Map<string, Route[]>();
  for (const r of routes) {
    adj.set(r.a, [...(adj.get(r.a) ?? []), r]);
    adj.set(r.b, [...(adj.get(r.b) ?? []), r]);
  }
  const used = new Set<number>();
  let best = 0;
  const dfs = (city: string, total: number) => {
    best = Math.max(best, total);
    for (const r of adj.get(city) ?? []) {
      if (used.has(r.id)) continue;
      used.add(r.id);
      dfs(r.a === city ? r.b : r.a, total + r.length);
      used.delete(r.id);
    }
  };
  for (const city of adj.keys()) dfs(city, 0);
  return best;
}

// ---------------------------------------------------------------- score final

export function computeResults(s: GameState): PlayerResult[] {
  const raw = s.players.map((p, seat) => {
    const tickets = p.tickets.map((id) => {
      const done = ticketDone(s, seat, id);
      return { id, done, points: done ? TICKET_BY_ID[id].points : -TICKET_BY_ID[id].points };
    });
    return {
      seat,
      routePoints: p.routePoints,
      tickets,
      ticketPoints: tickets.reduce((n, t) => n + t.points, 0),
      longest: longestPath(s, seat),
      longestBonus: 0,
      total: 0,
      rank: 0,
    };
  });
  const maxLongest = Math.max(...raw.map((r) => r.longest));
  for (const r of raw) {
    if (maxLongest > 0 && r.longest === maxLongest) r.longestBonus = LONGEST_BONUS;
    r.total = r.routePoints + r.ticketPoints + r.longestBonus;
  }
  const key = (r: PlayerResult) => [r.total, r.tickets.filter((t) => t.done).length, r.longestBonus];
  const sorted = [...raw].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
  });
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    r.rank = prev && key(prev).every((v, k) => v === key(r)[k]) ? prev.rank : i + 1;
  });
  return raw;
}

// ---------------------------------------------------------------- déroulement

function canDrawAnyCard(s: GameState, allowLoco: boolean): boolean {
  if (s.deck.length + s.discard.length > 0) return true;
  return s.market.some((c) => c !== null && (allowLoco || c !== 'loco'));
}

/** Le joueur courant a-t-il une autre option que passer ? */
export function hasLegalMove(s: GameState): boolean {
  const seat = s.current;
  if (canDrawAnyCard(s, true)) return true;
  if (s.ticketDeck.length > 0) return true;
  return ROUTES.some((r) => claimStatus(s, seat, r.id) === 'ok');
}

function finish(s: GameState) {
  s.phase = 'finished';
  s.turn = null;
  s.results = computeResults(s);
  const winner = s.results.find((r) => r.rank === 1)!;
  pushEvent(s, { seat: winner.seat, kind: 'end', text: `Fin de partie ! ${s.players[winner.seat].name} l'emporte.` });
}

function endTurn(s: GameState) {
  const p = s.players[s.current];
  s.turn = null;
  if (s.lastRound) {
    s.lastRound.turnsLeft -= 1;
    if (s.lastRound.turnsLeft <= 0) return finish(s);
  } else if (p.wagons <= 2) {
    s.lastRound = { trigger: s.current, turnsLeft: s.players.length };
    pushEvent(s, {
      seat: s.current,
      kind: 'lastRound',
      text: `${p.name} n'a plus que ${p.wagons} wagon${p.wagons > 1 ? 's' : ''} : dernier tour pour tout le monde !`,
    });
  }
  if (s.consecutivePasses >= s.players.length) return finish(s);
  s.current = (s.current + 1) % s.players.length;
  s.turnNumber += 1;
}

export function applyAction(state: GameState, seat: number, action: Action): GameState {
  if (state.phase === 'finished') fail('La partie est terminée.');
  if (seat !== state.current) fail("Ce n'est pas votre tour.");
  const s: GameState = structuredClone(state);
  const p = s.players[seat];
  const turn = s.turn;

  if (s.phase === 'setup' && action.type !== 'keepTickets') fail('Choisissez d’abord vos destinations.');
  if (turn?.kind === 'tickets' && action.type !== 'keepTickets') fail('Choisissez vos destinations.');
  if (turn?.kind === 'draw' && action.type !== 'drawFaceUp' && action.type !== 'drawDeck')
    fail('Vous devez prendre une seconde carte.');
  if (action.type !== 'pass') s.consecutivePasses = 0;

  switch (action.type) {
    case 'keepTickets': {
      if (turn?.kind !== 'tickets') fail('Aucune destination à choisir.');
      const keep = [...new Set(action.keep)];
      if (!keep.every((id) => turn.offered.includes(id))) fail('Destination invalide.');
      if (keep.length < Math.min(turn.min, turn.offered.length))
        fail(`Gardez au moins ${turn.min} destination${turn.min > 1 ? 's' : ''}.`);
      p.tickets.push(...keep);
      s.ticketDeck.push(...turn.offered.filter((id) => !keep.includes(id)));
      pushEvent(s, {
        seat,
        kind: 'keepTickets',
        count: keep.length,
        text: `${p.name} garde ${keep.length} destination${keep.length > 1 ? 's' : ''}.`,
      });
      if (s.phase === 'setup') {
        s.turn = null;
        if (seat + 1 < s.players.length) {
          s.current = seat + 1;
          s.turn = { kind: 'tickets', offered: drawTicketsFromDeck(s, 3), min: 2 };
        } else {
          s.phase = 'playing';
          s.current = 0;
        }
      } else {
        endTurn(s);
      }
      break;
    }

    case 'drawTickets': {
      if (s.ticketDeck.length === 0) fail('Plus de destinations disponibles.');
      s.turn = { kind: 'tickets', offered: drawTicketsFromDeck(s, 3), min: 1 };
      pushEvent(s, { seat, kind: 'drawTickets', text: `${p.name} pioche des destinations.` });
      break;
    }

    case 'drawFaceUp': {
      const card = s.market[action.index];
      if (!card) fail('Pas de carte à cet emplacement.');
      if (card === 'loco' && turn?.kind === 'draw') fail('Une locomotive visible ne peut pas être prise en seconde carte.');
      p.hand[card] += 1;
      s.market[action.index] = null;
      refillMarket(s);
      pushEvent(s, {
        seat,
        kind: 'drawFaceUp',
        card,
        text: `${p.name} prend une carte ${COLOR_NAMES[card]}.`,
      });
      if (card === 'loco' || turn?.kind === 'draw' || !canDrawAnyCard(s, false)) endTurn(s);
      else s.turn = { kind: 'draw', drawn: 1 };
      break;
    }

    case 'drawDeck': {
      const card = drawFromDeck(s);
      if (!card) fail('La pioche est vide.');
      p.hand[card] += 1;
      pushEvent(s, { seat, kind: 'drawDeck', card, text: `${p.name} pioche une carte.` });
      if (turn?.kind === 'draw' || !canDrawAnyCard(s, false)) endTurn(s);
      else s.turn = { kind: 'draw', drawn: 1 };
      break;
    }

    case 'claimRoute': {
      const route = ROUTE_BY_ID[action.routeId];
      if (!route) fail('Route inconnue.');
      const status = claimStatus(s, seat, route.id);
      if (status === 'owned') fail('Cette route est déjà prise.');
      if (status === 'pair') fail(s.players.length < 4 ? 'Voie double fermée à moins de 4 joueurs.' : 'Vous possédez déjà la voie parallèle.');
      if (status === 'wagons') fail('Pas assez de wagons.');
      const pay = computePayment(p.hand, route, action.color);
      if (!pay) fail('Cartes insuffisantes pour cette route.');
      if (pay.colored) {
        p.hand[pay.color] -= pay.colored;
        for (let i = 0; i < pay.colored; i++) s.discard.push(pay.color);
      }
      p.hand.loco -= pay.locos;
      for (let i = 0; i < pay.locos; i++) s.discard.push('loco');
      s.owners[route.id] = seat;
      p.wagons -= route.length;
      p.routePoints += ROUTE_POINTS[route.length];
      // la défausse peut permettre de compléter un marché incomplet
      refillMarket(s);
      pushEvent(s, {
        seat,
        kind: 'claimRoute',
        routeId: route.id,
        text: `${p.name} prend ${routeName(route)} (+${ROUTE_POINTS[route.length]}).`,
      });
      endTurn(s);
      break;
    }

    case 'pass': {
      if (hasLegalMove(s)) fail('Vous avez encore des coups possibles.');
      s.consecutivePasses += 1;
      pushEvent(s, { seat, kind: 'pass', text: `${p.name} passe son tour.` });
      endTurn(s);
      break;
    }

    default:
      fail('Action inconnue.');
  }
  return s;
}
