import type { MapId } from '../../shared/maps';
import type { Action, GameState, PlayerConfig } from '../../shared/types';
import { localApi } from './localApi';

export interface GameSummary {
  id: number;
  status: GameState['phase'];
  /** Carte jouée (absente pour les parties antérieures : France). */
  map_id?: string | null;
  created_at: string;
  updated_at: string;
  players: { seat: number; name: string; is_bot: number; color: string; score: number | null; rank: number | null }[];
}

export interface LeaderRow {
  name: string;
  is_bot: number;
  games: number;
  wins: number;
  avg_score: number;
  best_score: number;
  tickets_done: number;
  tickets_total: number;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // le code permet d'afficher le message dans la langue de l'interface
    const err = new Error(body.error ?? `Erreur ${res.status}`) as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
  return body as T;
}

type GameResponse = { id: number; state: GameState };

const httpApi = {
  listGames: () => call<GameSummary[]>('/api/games'),
  createGame: (players: PlayerConfig[], mapId: MapId = 'france') =>
    call<GameResponse>('/api/games', { method: 'POST', body: JSON.stringify({ players, mapId }) }),
  getGame: (id: number) => call<GameResponse>(`/api/games/${id}`),
  deleteGame: (id: number) => call<void>(`/api/games/${id}`, { method: 'DELETE' }),
  act: (id: number, seat: number, action: Action) =>
    call<GameResponse>(`/api/games/${id}/actions`, { method: 'POST', body: JSON.stringify({ seat, action }) }),
  bot: (id: number) => call<GameResponse>(`/api/games/${id}/bot`, { method: 'POST' }),
  stats: () => call<LeaderRow[]>('/api/stats'),
};

/** Build statique (GitHub Pages) : pas de serveur, tout tourne dans le navigateur. */
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';

export const api = OFFLINE ? localApi : httpApi;
