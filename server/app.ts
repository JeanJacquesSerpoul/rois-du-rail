import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { BOT_LEVELS, botAction } from '../shared/bot';
import { GameError, applyAction, createGame } from '../shared/engine';
import { MAP_IDS, type MapId } from '../shared/maps';
import { type RoomEvent, type RoomMeta, authorize, joinSeat, newRoom, seatInfos, seatOfToken } from '../shared/online';
import { playerProfile } from '../shared/stats';
import type { Action, BotLevel, GameState, PlayerColor, PlayerConfig } from '../shared/types';
import {
  deleteGame,
  finishedGamesOf,
  getGame,
  getRoom,
  insertGame,
  insertRoom,
  leaderboard,
  listGames,
  roomOfGame,
  saveMove,
  saveSeats,
} from './db';

const PLAYER_COLORS: PlayerColor[] = ['crimson', 'navy', 'forest', 'amber', 'violet'];
/** Pause entre deux actions d'un ordinateur dans un salon, pour que chacun suive. */
const ROOM_BOT_DELAY = Number(process.env.ROOM_BOT_DELAY ?? 900);

interface Client {
  ws: WebSocket;
  /** Siège contrôlé par cet appareil (-1 : simple spectateur). */
  seat: number;
  token?: string;
}

/**
 * Application Express et serveur HTTP : l'API REST des parties, les salons en ligne
 * et leurs mises à jour en direct (WebSocket sur /ws).
 */
export function createServer() {
  const app = express();
  app.use(express.json());
  const server = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // ——— salons : appareils connectés et ordinateurs joués par le serveur ———
  const clients = new Map<number, Set<Client>>();
  const botTimers = new Map<number, ReturnType<typeof setTimeout>>();

  const connectedSeats = (gameId: number) => new Set([...(clients.get(gameId) ?? [])].map((c) => c.seat));
  const seatsOf = (gameId: number, meta: RoomMeta, state: GameState) => seatInfos(meta, state, connectedSeats(gameId));

  function broadcast(gameId: number, event: RoomEvent) {
    const data = JSON.stringify(event);
    for (const c of clients.get(gameId) ?? []) if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
  }

  function publish(gameId: number, meta: RoomMeta, state: GameState) {
    broadcast(gameId, { t: 'state', state, seats: seatsOf(gameId, meta, state) });
  }

  /** Dans un salon, le serveur fait jouer les ordinateurs, une action à la fois. */
  function scheduleBots(gameId: number, meta: RoomMeta) {
    if (botTimers.has(gameId)) return;
    const state = getGame(gameId);
    if (!state || state.phase === 'finished' || !state.players[state.current].isBot) return;
    const delay = state.turn?.kind === 'draw' ? ROOM_BOT_DELAY * 0.6 : ROOM_BOT_DELAY;
    const timer = setTimeout(() => {
      botTimers.delete(gameId);
      const s = getGame(gameId);
      if (!s || s.phase === 'finished' || !s.players[s.current].isBot) return;
      try {
        const seat = s.current;
        const action = botAction(s);
        const next = applyAction(s, seat, action);
        saveMove(gameId, seat, action, next);
        publish(gameId, meta, next);
        scheduleBots(gameId, meta);
      } catch (e) {
        console.error('Ordinateur bloqué', gameId, e);
      }
    }, delay);
    botTimers.set(gameId, timer);
  }

  function roomOr404(code: string) {
    const room = getRoom(String(code).toUpperCase());
    if (!room) throw new GameError('roomNotFound', 'Salon introuvable.');
    const state = getGame(room.gameId);
    if (!state) throw new GameError('roomNotFound', 'Salon introuvable.');
    return { ...room, state };
  }

  // ——— parties ———
  const gameId = (req: Request) => Number(req.params.id);

  app.get('/api/games', (_req, res) => {
    res.json(listGames());
  });

  app.post('/api/games', (req, res) => {
    const raw = (req.body?.players ?? []) as Partial<PlayerConfig>[];
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 5) throw new GameError('players', 'Il faut entre 2 et 5 joueurs.');
    const players: PlayerConfig[] = raw.map((p, i) => ({
      name:
        String(p.name ?? '')
          .trim()
          .slice(0, 20) || `Joueur ${i + 1}`,
      isBot: Boolean(p.isBot),
      level: BOT_LEVELS.includes(p.level as BotLevel) ? p.level : 'normal',
      color: PLAYER_COLORS.includes(p.color as PlayerColor) ? (p.color as PlayerColor) : PLAYER_COLORS[i],
    }));
    if (new Set(players.map((p) => p.color)).size !== players.length)
      throw new GameError('colors', 'Chaque joueur doit avoir sa couleur.');
    const mapId = MAP_IDS.includes(req.body?.mapId) ? (req.body.mapId as MapId) : 'france';
    const online = Boolean(req.body?.online);
    if (online && players[0].isBot) throw new GameError('online', 'L’hôte du salon doit être un joueur humain.');
    const state = createGame(players, Math.floor(Math.random() * 2 ** 31), mapId);
    const id = insertGame(state);
    if (!online) return void res.status(201).json({ id, state });

    const { meta, hostToken } = newRoom(players);
    insertRoom(id, meta);
    scheduleBots(id, meta);
    res.status(201).json({ id, state, room: { code: meta.code, token: hostToken, seat: 0 } });
  });

  app.get('/api/games/:id', (req, res) => {
    const state = getGame(gameId(req));
    if (!state) return void res.status(404).json({ error: 'Partie introuvable.', code: 'notFound' });
    res.json({ id: gameId(req), state, room: roomOfGame(gameId(req)) });
  });

  app.delete('/api/games/:id', (req, res) => {
    const id = gameId(req);
    const code = roomOfGame(id);
    deleteGame(id);
    if (code) {
      broadcast(id, { t: 'error', code: 'roomNotFound', message: 'Salon fermé.' });
      for (const c of clients.get(id) ?? []) c.ws.close();
      clients.delete(id);
    }
    res.status(204).end();
  });

  /** Action d'un joueur humain (partie sur un seul appareil). */
  app.post('/api/games/:id/actions', (req, res) => {
    const id = gameId(req);
    const state = getGame(id);
    if (!state) return void res.status(404).json({ error: 'Partie introuvable.', code: 'notFound' });
    if (roomOfGame(id)) throw new GameError('online', 'Cette partie se joue en ligne, depuis son salon.');
    const { seat, action } = req.body as { seat: number; action: Action };
    if (state.players[seat]?.isBot) throw new GameError('botSeat', 'Ce joueur est contrôlé par l’ordinateur.');
    const next = applyAction(state, seat, action);
    saveMove(id, seat, action, next);
    res.json({ id, state: next });
  });

  /** Fait jouer une action à l'IA si c'est son tour (dans un salon, le serveur s'en charge). */
  app.post('/api/games/:id/bot', (req, res) => {
    const id = gameId(req);
    const state = getGame(id);
    if (!state) return void res.status(404).json({ error: 'Partie introuvable.', code: 'notFound' });
    if (roomOfGame(id)) throw new GameError('online', 'Cette partie se joue en ligne, depuis son salon.');
    if (state.phase === 'finished' || !state.players[state.current].isBot) return void res.json({ id, state });
    const seat = state.current;
    const action = botAction(state);
    const next = applyAction(state, seat, action);
    saveMove(id, seat, action, next);
    res.json({ id, state: next });
  });

  // ——— salons ———
  app.get('/api/rooms/:code', (req, res) => {
    const { gameId: id, meta, state } = roomOr404(String(req.params.code));
    scheduleBots(id, meta);
    res.json({ code: meta.code, gameId: id, state, seats: seatsOf(id, meta, state) });
  });

  /** Un invité prend une place libre (ou la reprend avec son jeton). */
  app.post('/api/rooms/:code/join', (req, res) => {
    const room = roomOr404(String(req.params.code));
    const { seat, name, token } = req.body as { seat: number; name: string; token?: string };
    const joined = joinSeat(room.meta, room.state, Number(seat), name, token || undefined);
    saveSeats(room.gameId, joined.meta, joined.state);
    for (const c of clients.get(room.gameId) ?? []) c.seat = seatOfToken(joined.meta, c.token);
    publish(room.gameId, joined.meta, joined.state);
    res.json({
      token: joined.token,
      seat: Number(seat),
      state: joined.state,
      seats: seatsOf(room.gameId, joined.meta, joined.state),
    });
  });

  /** Coup d'un joueur du salon : le jeton prouve qu'il contrôle ce siège ; le moteur valide le coup. */
  app.post('/api/rooms/:code/actions', (req, res) => {
    const { gameId: id, meta, state } = roomOr404(String(req.params.code));
    const { token, seat, action } = req.body as { token: string; seat: number; action: Action };
    authorize(meta, token, seat);
    const next = applyAction(state, seat, action);
    saveMove(id, seat, action, next);
    publish(id, meta, next);
    scheduleBots(id, meta);
    res.json({ state: next, seats: seatsOf(id, meta, next) });
  });

  // ——— statistiques ———
  app.get('/api/stats', (_req, res) => {
    res.json(leaderboard());
  });

  app.get('/api/players/:name', (req, res) => {
    const name = String(req.params.name);
    const profile = playerProfile(name, finishedGamesOf(name));
    if (!profile) return void res.status(404).json({ error: 'Joueur introuvable.', code: 'notFound' });
    res.json(profile);
  });

  const dist = resolve('dist');
  if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GameError) {
      const status = err.code === 'roomNotFound' ? 404 : err.code === 'badToken' ? 403 : 400;
      return void res.status(status).json({ error: err.message, code: err.code });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  // ——— WebSocket : /ws?room=CODE&token=JETON ———
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') return void socket.destroy();
    const code = (url.searchParams.get('room') ?? '').toUpperCase();
    const room = getRoom(code);
    if (!room) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      return void socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const token = url.searchParams.get('token') ?? undefined;
      const client: Client = { ws, seat: seatOfToken(room.meta, token), token };
      const set = clients.get(room.gameId) ?? new Set<Client>();
      set.add(client);
      clients.set(room.gameId, set);

      // état actuel (le salon a pu changer depuis la poignée de main)
      const fresh = getRoom(code);
      const state = getGame(room.gameId);
      if (!fresh || !state) return void ws.close();
      client.seat = seatOfToken(fresh.meta, token);
      ws.send(JSON.stringify({ t: 'room', code, state, seats: seatsOf(room.gameId, fresh.meta, state) } satisfies RoomEvent));
      broadcast(room.gameId, { t: 'seats', seats: seatsOf(room.gameId, fresh.meta, state) });
      scheduleBots(room.gameId, fresh.meta);

      let alive = true;
      ws.on('pong', () => {
        alive = true;
      });
      const ping = setInterval(() => {
        if (!alive) return void ws.terminate();
        alive = false;
        ws.ping();
      }, 30_000);

      ws.on('close', () => {
        clearInterval(ping);
        set.delete(client);
        if (set.size === 0) clients.delete(room.gameId);
        const r = getRoom(code);
        const s = getGame(room.gameId);
        if (r && s) broadcast(room.gameId, { t: 'seats', seats: seatsOf(room.gameId, r.meta, s) });
      });
    });
  });

  return {
    app,
    server,
    close() {
      for (const timer of botTimers.values()) clearTimeout(timer);
      botTimers.clear();
      for (const c of wss.clients) c.terminate();
      wss.close();
      server.close();
    },
  };
}
