import { describe, expect, it } from 'vitest';
import { applyAction, createGame, computePayment, longestPath } from './engine';
import { botAction } from './bot';
import { ROUTES, ROUTE_BY_ID } from './map';
import type { PlayerColor } from './types';

const colors: PlayerColor[] = ['crimson', 'navy', 'forest', 'amber', 'violet'];
const players = (n: number) => colors.slice(0, n).map((color, i) => ({ name: `Bot ${i + 1}`, isBot: true, color }));

describe('moteur', () => {
  it('distribue la partie', () => {
    const s = createGame(players(3), 42);
    expect(s.players.every((p) => Object.values(p.hand).reduce((a, b) => a + b) === 4)).toBe(true);
    expect(s.market.filter(Boolean)).toHaveLength(5);
    expect(s.deck.length + s.discard.length).toBe(110 - 12 - 5);
  });

  it('calcule les paiements', () => {
    const route = ROUTES.find((r) => r.color === 'red' && r.length === 3)!;
    const hand = { red: 2, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0, black: 0, white: 0, loco: 1 };
    expect(computePayment(hand, route, 'red')).toEqual({ color: 'red', colored: 2, locos: 1 });
    expect(computePayment(hand, route, 'blue')).toBeNull();
  });

  for (const n of [2, 3, 4, 5]) {
    it(`simule des parties complètes entre ${n} bots`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        let s = createGame(players(n), seed * 7919);
        let steps = 0;
        while (s.phase !== 'finished' && steps < 5000) {
          s = applyAction(s, s.current, botAction(s));
          steps++;
        }
        expect(s.phase).toBe('finished');
        expect(s.results).toHaveLength(n);
        const cards = s.deck.length + s.discard.length + s.market.filter(Boolean).length +
          s.players.reduce((t, p) => t + Object.values(p.hand).reduce((a, b) => a + b), 0);
        expect(cards).toBe(110);
        if (seed === 1) console.log(n, 'joueurs', steps, 'actions', s.results!.map((r) => `${r.total}(${r.tickets.filter(t=>t.done).length}/${r.tickets.length})`).join(' '));
      }
    });
  }

  it('longest path', () => {
    let s = createGame(players(2), 3);
    s = { ...s, owners: { 0: 0, 1: 0 } };
    expect(longestPath(s, 0)).toBe(ROUTE_BY_ID[0].length + ROUTE_BY_ID[1].length);
  });
});

describe('niveaux de l’ordinateur', () => {
  const play = (levels: ('easy' | 'normal' | 'hard')[], seed: number) => {
    let s = createGame(levels.map((level, i) => ({ name: `B${i}`, isBot: true, color: colors[i], level })), seed);
    let steps = 0;
    while (s.phase !== 'finished' && steps++ < 5000) s = applyAction(s, s.current, botAction(s));
    return s;
  };

  it('termine les parties à tous les niveaux', () => {
    for (let seed = 1; seed <= 8; seed++) expect(play(['easy', 'normal', 'hard', 'easy'], seed * 31).phase).toBe('finished');
  });

  it('le niveau difficile marque plus que le niveau facile', () => {
    let diff = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const order: ('easy' | 'hard')[] = seed % 2 ? ['easy', 'hard'] : ['hard', 'easy'];
      const s = play(order, seed * 977);
      const score = (l: string) => s.results!.find((r) => order[r.seat] === l)!.total;
      diff += score('hard') - score('easy');
    }
    expect(diff / 20).toBeGreaterThan(15);
  });
});

describe('chef de gare', () => {
  it('donne à chaque étape un conseil légal et expliqué', async () => {
    const { advise } = await import('./advisor');
    for (let seed = 1; seed <= 6; seed++) {
      let s = createGame(
        colors.slice(0, 3).map((color, i) => ({ name: `J${i}`, isBot: i > 0, color, level: 'normal' as const })),
        seed * 4421,
      );
      let steps = 0;
      while (s.phase !== 'finished' && steps++ < 5000) {
        if (s.current === 0) {
          const a = advise(s, 0);
          expect(a.headline.length).toBeGreaterThan(0);
          expect(a.reasons.length).toBeGreaterThan(0);
          s = applyAction(s, 0, a.action);
        } else s = applyAction(s, s.current, botAction(s));
      }
      expect(s.phase).toBe('finished');
    }
  });
});
