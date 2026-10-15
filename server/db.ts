import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RoomMeta } from '../shared/online';
import type { FinishedGame } from '../shared/stats';
import type { Action, GameState } from '../shared/types';

// « :memory: » : base temporaire (tests)
const DB_PATH = process.env.DB_PATH === ':memory:' ? ':memory:' : resolve(process.env.DB_PATH ?? 'data/rois-du-rail.db');
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    status      TEXT NOT NULL,
    state_json  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS game_players (
    game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seat        INTEGER NOT NULL,
    name        TEXT NOT NULL,
    is_bot      INTEGER NOT NULL,
    color       TEXT NOT NULL,
    score       INTEGER,
    rank        INTEGER,
    tickets_done INTEGER,
    tickets_total INTEGER,
    PRIMARY KEY (game_id, seat)
  );

  CREATE TABLE IF NOT EXISTS moves (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seat        INTEGER NOT NULL,
    action_json TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- parties en ligne : code du salon et places (jetons secrets des joueurs)
  CREATE TABLE IF NOT EXISTS rooms (
    code        TEXT PRIMARY KEY,
    game_id     INTEGER NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    seats_json  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
  CREATE INDEX IF NOT EXISTS idx_players_name ON game_players(name);
`);

export interface GameRow {
  id: number;
  status: string;
  state_json: string;
  created_at: string;
  updated_at: string;
}

export function insertGame(state: GameState): number {
  const res = db.prepare('INSERT INTO games (status, state_json) VALUES (?, ?)').run(state.phase, JSON.stringify(state));
  const id = Number(res.lastInsertRowid);
  const ins = db.prepare('INSERT INTO game_players (game_id, seat, name, is_bot, color) VALUES (?, ?, ?, ?, ?)');
  for (const [seat, p] of state.players.entries()) ins.run(id, seat, p.name, p.isBot ? 1 : 0, p.color);
  return id;
}

export function getGame(id: number): GameState | null {
  const row = db.prepare('SELECT state_json FROM games WHERE id = ?').get(id) as Pick<GameRow, 'state_json'> | undefined;
  return row ? (JSON.parse(row.state_json) as GameState) : null;
}

export function saveMove(id: number, seat: number, action: Action, state: GameState) {
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO moves (game_id, seat, action_json) VALUES (?, ?, ?)').run(id, seat, JSON.stringify(action));
    db.prepare("UPDATE games SET status = ?, state_json = ?, updated_at = datetime('now') WHERE id = ?").run(
      state.phase,
      JSON.stringify(state),
      id,
    );
    if (state.phase === 'finished' && state.results) {
      const upd = db.prepare(
        'UPDATE game_players SET score = ?, rank = ?, tickets_done = ?, tickets_total = ? WHERE game_id = ? AND seat = ?',
      );
      for (const r of state.results)
        upd.run(r.total, r.rank, r.tickets.filter((t) => t.done).length, r.tickets.length, id, r.seat);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function listGames() {
  const games = db
    .prepare(
      `SELECT g.id, g.status, json_extract(g.state_json, '$.mapId') AS map_id, r.code AS room, g.created_at, g.updated_at
         FROM games g LEFT JOIN rooms r ON r.game_id = g.id
        ORDER BY g.updated_at DESC LIMIT 30`,
    )
    .all() as Omit<GameRow, 'state_json'>[];
  const players = db.prepare('SELECT seat, name, is_bot, color, score, rank FROM game_players WHERE game_id = ? ORDER BY seat');
  return games.map((g) => ({ ...g, players: players.all(g.id) }));
}

export function deleteGame(id: number) {
  db.prepare('DELETE FROM games WHERE id = ?').run(id);
}

export function leaderboard() {
  return db
    .prepare(
      `SELECT gp.name,
              MAX(gp.is_bot) AS is_bot,
              COUNT(*) AS games,
              SUM(CASE WHEN gp.rank = 1 THEN 1 ELSE 0 END) AS wins,
              ROUND(AVG(gp.score), 1) AS avg_score,
              MAX(gp.score) AS best_score,
              SUM(gp.tickets_done) AS tickets_done,
              SUM(gp.tickets_total) AS tickets_total
         FROM game_players gp
         JOIN games g ON g.id = gp.game_id
        WHERE g.status = 'finished'
        GROUP BY gp.name
        ORDER BY wins DESC, avg_score DESC
        LIMIT 50`,
    )
    .all();
}

export function insertRoom(gameId: number, meta: RoomMeta) {
  db.prepare('INSERT INTO rooms (code, game_id, seats_json) VALUES (?, ?, ?)').run(meta.code, gameId, JSON.stringify(meta.seats));
}

export function getRoom(code: string): { gameId: number; meta: RoomMeta } | null {
  const row = db.prepare('SELECT game_id, seats_json FROM rooms WHERE code = ?').get(code) as
    | { game_id: number; seats_json: string }
    | undefined;
  return row ? { gameId: row.game_id, meta: { code, seats: JSON.parse(row.seats_json) } } : null;
}

export function roomOfGame(gameId: number): string | null {
  const row = db.prepare('SELECT code FROM rooms WHERE game_id = ?').get(gameId) as { code: string } | undefined;
  return row?.code ?? null;
}

/** Un invité a pris sa place : on garde son jeton et son nom. */
export function saveSeats(gameId: number, meta: RoomMeta, state: GameState) {
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE rooms SET seats_json = ? WHERE game_id = ?').run(JSON.stringify(meta.seats), gameId);
    db.prepare('UPDATE games SET state_json = ? WHERE id = ?').run(JSON.stringify(state), gameId);
    const upd = db.prepare('UPDATE game_players SET name = ? WHERE game_id = ? AND seat = ?');
    for (const [seat, p] of state.players.entries()) upd.run(p.name, gameId, seat);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Parties terminées d'un joueur, avec leurs coups, pour sa fiche. */
export function finishedGamesOf(name: string): FinishedGame[] {
  const games = db
    .prepare(
      `SELECT g.id, g.state_json, g.updated_at FROM games g
        WHERE g.status = 'finished' AND EXISTS (SELECT 1 FROM game_players gp WHERE gp.game_id = g.id AND gp.name = ?)
        ORDER BY g.updated_at`,
    )
    .all(name) as { id: number; state_json: string; updated_at: string }[];
  const moves = db.prepare('SELECT seat, action_json FROM moves WHERE game_id = ? ORDER BY id');
  return games.map((g) => ({
    id: g.id,
    date: g.updated_at,
    state: JSON.parse(g.state_json) as GameState,
    moves: (moves.all(g.id) as { seat: number; action_json: string }[]).map((m) => ({
      seat: m.seat,
      action: JSON.parse(m.action_json) as Action,
    })),
  }));
}
