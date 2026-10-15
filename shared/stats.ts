import { mapOf } from './engine';
import type { MapId } from './maps';
import type { Action, CardColor, GameState } from './types';

/**
 * Historique et statistiques d'un joueur, calculés à partir des parties terminées
 * et de leurs coups (côté serveur : tables `games` et `moves` ; hors ligne : stockage du navigateur).
 */

export interface FinishedGame {
  id: number;
  /** Date de fin (ISO ou « AAAA-MM-JJ HH:MM:SS »). */
  date: string;
  state: GameState;
  moves: { seat: number; action: Action }[];
}

export interface HistoryEntry {
  gameId: number;
  date: string;
  mapId: MapId;
  score: number;
  rank: number;
  players: number;
  won: boolean;
  ticketsDone: number;
  ticketsTotal: number;
}

export interface PlayerProfile {
  name: string;
  isBot: boolean;
  games: number;
  wins: number;
  avgScore: number;
  bestScore: number;
  ticketsDone: number;
  ticketsTotal: number;
  /** Du plus ancien au plus récent. */
  history: HistoryEntry[];
  /** Cartes Wagon jouées pour poser des routes (nombre de cartes par couleur, locomotives comprises). */
  cards: { color: CardColor; count: number }[];
  maps: { mapId: MapId; games: number; wins: number }[];
  /** Routes le plus souvent prises. */
  routes: { mapId: MapId; routeId: number; count: number }[];
}

export function playerProfile(name: string, games: FinishedGame[]): PlayerProfile | null {
  const history: HistoryEntry[] = [];
  const cards = new Map<CardColor, number>();
  const maps = new Map<MapId, { games: number; wins: number }>();
  const routes = new Map<string, { mapId: MapId; routeId: number; count: number }>();
  let isBot = false;

  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  for (const g of sorted) {
    const seat = g.state.players.findIndex((p) => p.name === name);
    if (seat < 0 || !g.state.results) continue;
    const result = g.state.results.find((r) => r.seat === seat);
    if (!result) continue;
    const map = mapOf(g.state);
    isBot ||= g.state.players[seat].isBot;
    history.push({
      gameId: g.id,
      date: g.date,
      mapId: map.id,
      score: result.total,
      rank: result.rank,
      players: g.state.players.length,
      won: result.rank === 1,
      ticketsDone: result.tickets.filter((t) => t.done).length,
      ticketsTotal: result.tickets.length,
    });
    const m = maps.get(map.id) ?? { games: 0, wins: 0 };
    m.games += 1;
    m.wins += result.rank === 1 ? 1 : 0;
    maps.set(map.id, m);

    for (const move of g.moves) {
      if (move.seat !== seat || move.action.type !== 'claimRoute') continue;
      const route = map.routeById[move.action.routeId];
      if (!route) continue;
      // couleur choisie pour payer ; la longueur donne le nombre de cartes
      cards.set(move.action.color, (cards.get(move.action.color) ?? 0) + route.length);
      const key = `${map.id}:${route.id}`;
      const r = routes.get(key) ?? { mapId: map.id, routeId: route.id, count: 0 };
      r.count += 1;
      routes.set(key, r);
    }
  }
  if (history.length === 0) return null;

  const total = history.reduce((n, h) => n + h.score, 0);
  return {
    name,
    isBot,
    games: history.length,
    wins: history.filter((h) => h.won).length,
    avgScore: Math.round((10 * total) / history.length) / 10,
    bestScore: Math.max(...history.map((h) => h.score)),
    ticketsDone: history.reduce((n, h) => n + h.ticketsDone, 0),
    ticketsTotal: history.reduce((n, h) => n + h.ticketsTotal, 0),
    history,
    cards: [...cards.entries()].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count),
    maps: [...maps.entries()].map(([mapId, v]) => ({ mapId, ...v })).sort((a, b) => b.games - a.games),
    routes: [...routes.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}
