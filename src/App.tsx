import { useEffect, useState } from 'react';
import type { PlayerConfig } from '../shared/types';
import { Game } from './components/Game';
import { Home, Setup } from './components/Screens';
import { api } from './lib/api';

type Route = { name: 'home' } | { name: 'setup' } | { name: 'game'; id: number };

function parseHash(): Route {
  const m = location.hash.match(/^#\/partie\/(\d+)/);
  if (m) return { name: 'game', id: Number(m[1]) };
  if (location.hash === '#/nouvelle') return { name: 'setup' };
  return { name: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (hash: string) => {
    location.hash = hash;
  };

  const start = async (players: PlayerConfig[]) => {
    const { id } = await api.createGame(players);
    go(`#/partie/${id}`);
  };

  switch (route.name) {
    case 'setup':
      return <Setup onStart={start} onBack={() => go('#/')} />;
    case 'game':
      return <Game key={route.id} id={route.id} onExit={() => go('#/')} onNewGame={() => go('#/nouvelle')} />;
    default:
      return <Home onNew={() => go('#/nouvelle')} onOpen={(id) => go(`#/partie/${id}`)} />;
  }
}
