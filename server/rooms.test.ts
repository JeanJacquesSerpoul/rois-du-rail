import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { RoomEvent, SeatInfo } from '../shared/online';
import type { GameState } from '../shared/types';

// base en mémoire et ordinateurs rapides, avant de charger le serveur
process.env.DB_PATH = ':memory:';
process.env.ROOM_BOT_DELAY = '5';

let base = '';
let close = () => {};

beforeAll(async () => {
  const { createServer } = await import('./app');
  const srv = createServer();
  await new Promise<void>((done) => srv.server.listen(0, '127.0.0.1', done));
  base = `127.0.0.1:${(srv.server.address() as AddressInfo).port}`;
  close = srv.close;
});
afterAll(() => close());

async function post<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`http://${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

/** Ouvre le WebSocket d'un salon et garde les événements reçus. */
function listen(code: string, token?: string) {
  const events: RoomEvent[] = [];
  const ws = new WebSocket(`ws://${base}/ws?room=${code}${token ? `&token=${token}` : ''}`);
  ws.on('message', (data) => events.push(JSON.parse(String(data)) as RoomEvent));
  const opened = new Promise<void>((done) => ws.on('open', () => done()));
  const until = async (pred: (e: RoomEvent) => boolean) => {
    for (let i = 0; i < 200; i++) {
      const found = events.find(pred);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('événement attendu non reçu');
  };
  return { ws, events, opened, until };
}

type Created = { id: number; state: GameState; room: { code: string; token: string; seat: number } };
type Joined = { token: string; seat: number; state: GameState; seats: SeatInfo[] };

describe('salons en ligne', () => {
  it('crée un salon, accueille un invité et diffuse les coups en direct', async () => {
    const created = await post<Created>('/api/games', {
      online: true,
      players: [
        { name: 'Ada', isBot: false, color: 'crimson' },
        { name: 'Invité', isBot: false, color: 'navy' },
      ],
    });
    expect(created.status).toBe(201);
    const { code, token: hostToken } = created.body.room;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    const room = (await (await fetch(`http://${base}/api/rooms/${code}`)).json()) as { seats: SeatInfo[] };
    expect(room.seats.map((s) => [s.kind, s.claimed])).toEqual([
      ['host', true],
      ['remote', false],
    ]);

    // l'hôte ne peut pas passer par l'API locale pour une partie en ligne
    const local = await post<{ code: string }>(`/api/games/${created.body.id}/actions`, { seat: 0, action: { type: 'pass' } });
    expect(local.body.code).toBe('online');

    const host = listen(code, hostToken);
    await host.opened;
    await host.until((e) => e.t === 'room');

    const joined = await post<Joined>(`/api/rooms/${code}/join`, { seat: 1, name: 'Grace' });
    expect(joined.status).toBe(200);
    expect(joined.body.state.players[1].name).toBe('Grace');
    // la place est prise : un autre appareil ne peut plus la prendre
    expect((await post<{ code: string }>(`/api/rooms/${code}/join`, { seat: 1, name: 'Intrus' })).body.code).toBe('seatTaken');

    // un jeton ne permet de jouer que pour son siège
    const state = joined.body.state;
    if (state.turn?.kind !== 'tickets') throw new Error('choix des destinations attendu');
    const keep = state.turn.offered;
    const wrong = await post<{ code: string }>(`/api/rooms/${code}/actions`, {
      token: joined.body.token,
      seat: 0,
      action: { type: 'keepTickets', keep },
    });
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe('badToken');

    // l'hôte choisit ses destinations : l'invité reçoit le nouvel état
    const guest = listen(code, joined.body.token);
    await guest.opened;
    const before = state.eventSeq;
    const ok = await post<{ state: GameState }>(`/api/rooms/${code}/actions`, {
      token: hostToken,
      seat: state.current,
      action: { type: 'keepTickets', keep },
    });
    expect(ok.status).toBe(200);
    const pushed = await guest.until((e) => e.t === 'state' && e.state.eventSeq > before);
    expect(pushed.t === 'state' && pushed.state.current).toBe(ok.body.state.current);
    // présence : les deux appareils sont connectés
    expect(pushed.t === 'state' && pushed.seats.every((s) => s.connected)).toBe(true);

    host.ws.close();
    guest.ws.close();
  });

  it('fait jouer les ordinateurs du salon côté serveur', async () => {
    const created = await post<Created>('/api/games', {
      online: true,
      players: [
        { name: 'Ada', isBot: false, color: 'crimson' },
        { name: 'Robot', isBot: true, color: 'navy', level: 'easy' },
      ],
    });
    const { code, token } = created.body.room;
    const host = listen(code, token);
    await host.opened;
    const s = created.body.state;
    if (s.turn?.kind !== 'tickets') throw new Error('choix des destinations attendu');
    await post(`/api/rooms/${code}/actions`, { token, seat: 0, action: { type: 'keepTickets', keep: s.turn.offered } });
    // l'ordinateur choisit à son tour, sans que personne ne le demande
    await host.until((e) => e.t === 'state' && e.state.phase === 'playing' && e.state.current === 0);
    host.ws.close();
  });

  it('refuse un salon inconnu et un hôte ordinateur', async () => {
    expect((await fetch(`http://${base}/api/rooms/ZZZZZZ`)).status).toBe(404);
    const res = await post<{ code: string }>('/api/games', {
      online: true,
      players: [
        { name: 'Robot', isBot: true, color: 'crimson' },
        { name: 'Ada', isBot: false, color: 'navy' },
      ],
    });
    expect(res.body.code).toBe('online');
  });
});
