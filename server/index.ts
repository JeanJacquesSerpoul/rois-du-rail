import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOT_LEVELS, botAction } from '../shared/bot';
import { GameError, applyAction, createGame } from '../shared/engine';
import type { Action, BotLevel, PlayerColor, PlayerConfig } from '../shared/types';
import { deleteGame, getGame, insertGame, leaderboard, listGames, saveMove } from './db';

const PLAYER_COLORS: PlayerColor[] = ['crimson', 'navy', 'forest', 'amber', 'violet'];
const app = express();
app.use(express.json());

const gameId = (req: Request) => Number(req.params.id);

app.get('/api/games', (_req, res) => {
  res.json(listGames());
});

app.post('/api/games', (req, res) => {
  const raw = (req.body?.players ?? []) as Partial<PlayerConfig>[];
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 5) throw new GameError('Il faut entre 2 et 5 joueurs.');
  const players: PlayerConfig[] = raw.map((p, i) => ({
    name: String(p.name ?? '').trim().slice(0, 20) || `Joueur ${i + 1}`,
    isBot: Boolean(p.isBot),
    level: BOT_LEVELS.includes(p.level as BotLevel) ? p.level : 'normal',
    color: PLAYER_COLORS.includes(p.color as PlayerColor) ? (p.color as PlayerColor) : PLAYER_COLORS[i],
  }));
  if (new Set(players.map((p) => p.color)).size !== players.length) throw new GameError('Chaque joueur doit avoir sa couleur.');
  const state = createGame(players, Math.floor(Math.random() * 2 ** 31));
  const id = insertGame(state);
  res.status(201).json({ id, state });
});

app.get('/api/games/:id', (req, res) => {
  const state = getGame(gameId(req));
  if (!state) return void res.status(404).json({ error: 'Partie introuvable.' });
  res.json({ id: gameId(req), state });
});

app.delete('/api/games/:id', (req, res) => {
  deleteGame(gameId(req));
  res.status(204).end();
});

/** Action d'un joueur humain. */
app.post('/api/games/:id/actions', (req, res) => {
  const id = gameId(req);
  const state = getGame(id);
  if (!state) return void res.status(404).json({ error: 'Partie introuvable.' });
  const { seat, action } = req.body as { seat: number; action: Action };
  if (state.players[seat]?.isBot) throw new GameError('Ce joueur est contrôlé par l’ordinateur.');
  const next = applyAction(state, seat, action);
  saveMove(id, seat, action, next);
  res.json({ id, state: next });
});

/** Fait jouer une action à l'IA si c'est son tour. */
app.post('/api/games/:id/bot', (req, res) => {
  const id = gameId(req);
  const state = getGame(id);
  if (!state) return void res.status(404).json({ error: 'Partie introuvable.' });
  if (state.phase === 'finished' || !state.players[state.current].isBot) return void res.json({ id, state });
  const seat = state.current;
  const action = botAction(state);
  const next = applyAction(state, seat, action);
  saveMove(id, seat, action, next);
  res.json({ id, state: next });
});

app.get('/api/stats', (_req, res) => {
  res.json(leaderboard());
});

const dist = resolve('dist');
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof GameError) return void res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// En développement, PORT peut être celui de Vite : on utilise API_PORT pour l'API.
const port = Number(process.env.API_PORT ?? (process.env.NODE_ENV === 'production' ? process.env.PORT : undefined) ?? 3001);
app.listen(port, '0.0.0.0', () => console.log(`🚂 Rois du Rail – API sur http://localhost:${port}`));
