import { BOT_LEVELS, botAction } from '../../shared/bot';
import { applyAction, createGame } from '../../shared/engine';
import type { Action, GameState, PlayerConfig } from '../../shared/types';
import type { GameSummary, LeaderRow } from './api';

/**
 * Version « hors ligne » de l'API, utilisée pour la démo statique (GitHub Pages) :
 * le moteur tourne dans le navigateur et les parties sont gardées dans localStorage.
 */

const KEY = 'rdr.games.v1';

interface StoredGame {
  state: GameState;
  created_at: string;
  updated_at: string;
}

interface Store {
  nextId: number;
  games: Record<number, StoredGame>;
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* stockage indisponible ou corrompu : on repart de zéro */
  }
  return { nextId: 1, games: {} };
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* navigation privée : la partie reste en mémoire le temps de la session */
  }
}

let memory: Store | null = null;
const store = () => (memory ??= load());

function getStored(id: number): StoredGame {
  const g = store().games[id];
  if (!g) throw new Error('Partie introuvable.');
  return g;
}

function update(id: number, state: GameState) {
  const g = getStored(id);
  g.state = state;
  g.updated_at = now();
  save(store());
  return { id, state };
}

function summary(id: number, g: StoredGame): GameSummary {
  return {
    id,
    status: g.state.phase,
    created_at: g.created_at,
    updated_at: g.updated_at,
    players: g.state.players.map((p, seat) => {
      const r = g.state.results?.find((x) => x.seat === seat);
      return { seat, name: p.name, is_bot: p.isBot ? 1 : 0, color: p.color, score: r?.total ?? null, rank: r?.rank ?? null };
    }),
  };
}

// Les appels restent asynchrones pour garder la même interface que l'API HTTP.
const wrap = <T>(fn: () => T): Promise<T> => {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error(String(e)));
  }
};

export const localApi = {
  listGames: () =>
    wrap(() =>
      Object.entries(store().games)
        .map(([id, g]) => summary(Number(id), g))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 30),
    ),

  createGame: (players: PlayerConfig[]) =>
    wrap(() => {
      const configs = players.map((p, i) => ({
        ...p,
        name: p.name.trim().slice(0, 20) || `Joueur ${i + 1}`,
        level: p.level && BOT_LEVELS.includes(p.level) ? p.level : 'normal',
      }));
      if (new Set(configs.map((p) => p.color)).size !== configs.length) throw new Error('Chaque joueur doit avoir sa couleur.');
      const state = createGame(configs, Math.floor(Math.random() * 2 ** 31));
      const s = store();
      const id = s.nextId++;
      s.games[id] = { state, created_at: now(), updated_at: now() };
      save(s);
      return { id, state };
    }),

  getGame: (id: number) => wrap(() => ({ id, state: getStored(id).state })),

  deleteGame: (id: number) =>
    wrap(() => {
      delete store().games[id];
      save(store());
    }),

  act: (id: number, seat: number, action: Action) =>
    wrap(() => {
      const state = getStored(id).state;
      if (state.players[seat]?.isBot) throw new Error('Ce joueur est contrôlé par l’ordinateur.');
      return update(id, applyAction(state, seat, action));
    }),

  bot: (id: number) =>
    wrap(() => {
      const state = getStored(id).state;
      if (state.phase === 'finished' || !state.players[state.current].isBot) return { id, state };
      return update(id, applyAction(state, state.current, botAction(state)));
    }),

  stats: () =>
    wrap(() => {
      const rows = new Map<string, LeaderRow & { total: number }>();
      for (const g of Object.values(store().games)) {
        if (g.state.phase !== 'finished' || !g.state.results) continue;
        for (const r of g.state.results) {
          const p = g.state.players[r.seat];
          const row = rows.get(p.name) ?? {
            name: p.name,
            is_bot: 0,
            games: 0,
            wins: 0,
            avg_score: 0,
            best_score: -Infinity,
            tickets_done: 0,
            tickets_total: 0,
            total: 0,
          };
          row.is_bot = Math.max(row.is_bot, p.isBot ? 1 : 0);
          row.games += 1;
          row.wins += r.rank === 1 ? 1 : 0;
          row.total += r.total;
          row.best_score = Math.max(row.best_score, r.total);
          row.tickets_done += r.tickets.filter((t) => t.done).length;
          row.tickets_total += r.tickets.length;
          rows.set(p.name, row);
        }
      }
      return [...rows.values()]
        .map(({ total, ...row }) => ({ ...row, avg_score: Math.round((10 * total) / row.games) / 10 }))
        .sort((a, b) => b.wins - a.wins || b.avg_score - a.avg_score)
        .slice(0, 50);
    }),
};
