import { describe, expect, it } from 'vitest';
import { botAction } from './bot';
import { applyAction, createGame } from './engine';
import { GameError } from './engine';
import { MAPS, type MapId } from './maps';
import { authorize, joinSeat, newRoom, seatInfos, seatOfToken } from './online';
import { type FinishedGame, playerProfile } from './stats';
import type { Action, GameState } from './types';

/** Partie complète entre ordinateurs, avec ses coups. */
function play(seed: number, mapId: MapId, names: string[]): { state: GameState; moves: FinishedGame['moves'] } {
  const colors = ['crimson', 'navy', 'forest'] as const;
  let s = createGame(
    names.map((name, i) => ({ name, isBot: true, color: colors[i] })),
    seed,
    mapId,
  );
  const moves: { seat: number; action: Action }[] = [];
  let steps = 0;
  while (s.phase !== 'finished' && steps++ < 5000) {
    const action = botAction(s);
    moves.push({ seat: s.current, action });
    s = applyAction(s, s.current, action);
  }
  return { state: s, moves };
}

describe('fiche joueur', () => {
  const g1 = play(1, 'france', ['Ada', 'Grace']);
  const g2 = play(2, 'europe', ['Grace', 'Ada', 'Linus']);
  const games: FinishedGame[] = [
    { id: 2, date: '2026-10-02 10:00:00', ...g2 },
    { id: 1, date: '2026-10-01 10:00:00', ...g1 },
  ];

  it('résume les parties terminées du joueur, de la plus ancienne à la plus récente', () => {
    const p = playerProfile('Ada', games)!;
    expect(p.games).toBe(2);
    expect(p.history.map((h) => h.gameId)).toEqual([1, 2]);
    expect(p.history.map((h) => h.mapId)).toEqual(['france', 'europe']);
    const scores = [g1, g2].map((g) => g.state.results!.find((r) => g.state.players[r.seat].name === 'Ada')!.total);
    expect(p.history.map((h) => h.score)).toEqual(scores);
    expect(p.bestScore).toBe(Math.max(...scores));
    expect(p.avgScore).toBeCloseTo((scores[0] + scores[1]) / 2, 1);
    expect(p.maps.map((m) => m.mapId).sort()).toEqual(['europe', 'france']);
  });

  it('compte les cartes dépensées pour les routes posées', () => {
    const p = playerProfile('Ada', games)!;
    const seat1 = g1.state.players.findIndex((x) => x.name === 'Ada');
    const seat2 = g2.state.players.findIndex((x) => x.name === 'Ada');
    const spent = (g: typeof g1, seat: number, mapId: MapId) =>
      g.moves
        .filter((m) => m.seat === seat && m.action.type === 'claimRoute')
        .reduce((n, m) => n + MAPS[mapId].routeById[(m.action as { routeId: number }).routeId].length, 0);
    const total = p.cards.reduce((n, c) => n + c.count, 0);
    expect(total).toBe(spent(g1, seat1, 'france') + spent(g2, seat2, 'europe'));
    // triées de la plus jouée à la moins jouée
    expect(p.cards.map((c) => c.count)).toEqual([...p.cards.map((c) => c.count)].sort((a, b) => b - a));
    expect(p.routes.length).toBeGreaterThan(0);
  });

  it('ignore un joueur inconnu', () => {
    expect(playerProfile('Personne', games)).toBeNull();
  });
});

describe('salons', () => {
  const state = createGame(
    [
      { name: 'Hôte', isBot: false, color: 'crimson' },
      { name: 'Invité 2', isBot: false, color: 'navy' },
      { name: 'Robot', isBot: true, color: 'forest' },
    ],
    7,
  );

  it('distribue les places : hôte, invités, ordinateurs', () => {
    const { meta, hostToken } = newRoom(state.players);
    expect(meta.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(meta.seats.map((s) => s.kind)).toEqual(['host', 'remote', 'bot']);
    expect(seatOfToken(meta, hostToken)).toBe(0);
    expect(seatInfos(meta, state, new Set([0])).map((s) => [s.claimed, s.connected])).toEqual([
      [true, true],
      [false, false],
      [true, true],
    ]);
  });

  it('laisse un invité prendre une place libre, puis la reprendre avec son jeton', () => {
    const { meta } = newRoom(state.players);
    const joined = joinSeat(meta, state, 1, '  Grace  ', undefined);
    expect(joined.state.players[1].name).toBe('Grace');
    expect(state.players[1].name).toBe('Invité 2');
    expect(() => joinSeat(joined.meta, joined.state, 1, 'Intrus')).toThrow(GameError);
    const again = joinSeat(joined.meta, joined.state, 1, 'Grace H.', joined.token);
    expect(again.token).toBe(joined.token);
    expect(() => joinSeat(joined.meta, joined.state, 0, 'Pirate')).toThrow(GameError);
    expect(() => joinSeat(joined.meta, joined.state, 2, 'Pirate')).toThrow(GameError);
  });

  it("n'autorise un coup que pour le siège du jeton", () => {
    const { meta, hostToken } = newRoom(state.players);
    expect(() => authorize(meta, hostToken, 0)).not.toThrow();
    expect(() => authorize(meta, hostToken, 1)).toThrow(GameError);
    expect(() => authorize(meta, '', 2)).toThrow(GameError);
  });
});
