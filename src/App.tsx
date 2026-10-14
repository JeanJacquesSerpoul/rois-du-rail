import { AnimatePresence } from 'motion/react';
import { Suspense, lazy, useEffect, useState } from 'react';
import type { PlayerConfig } from '../shared/types';
import { Game } from './components/Game';
import { Home, Setup } from './components/Screens';
import { startTutorial } from './components/Tutorial';
import { api } from './lib/api';
import { introSeen } from './lib/intro';

// présentation chargée à la demande (première visite ou bouton de l'accueil)
const IntroVideo = lazy(() => import('./components/IntroVideo').then((m) => ({ default: m.IntroVideo })));

type Route = { name: 'home' } | { name: 'setup' } | { name: 'game'; id: number };

function parseHash(): Route {
  const m = location.hash.match(/^#\/partie\/(\d+)/);
  if (m) return { name: 'game', id: Number(m[1]) };
  if (location.hash === '#/nouvelle') return { name: 'setup' };
  return { name: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  // présentation animée à la toute première ouverture, puis sur demande depuis l'accueil
  const [showIntro, setShowIntro] = useState(() => !introSeen());

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

  /** Partie guidée : une vraie partie contre un ordinateur facile, commentée par le chef de gare. */
  const tutorial = async () => {
    let name = 'Vous';
    try {
      name = localStorage.getItem('rdr.name') || name;
    } catch {
      /* stockage indisponible */
    }
    const { id } = await api.createGame([
      { name, isBot: false, color: 'crimson' },
      { name: 'Gustave', isBot: true, color: 'navy', level: 'easy' },
    ]);
    startTutorial(id);
    go(`#/partie/${id}`);
  };

  let screen: React.ReactNode;
  switch (route.name) {
    case 'setup':
      screen = <Setup onStart={start} onBack={() => go('#/')} />;
      break;
    case 'game':
      screen = <Game key={route.id} id={route.id} onExit={() => go('#/')} onNewGame={() => go('#/nouvelle')} />;
      break;
    default:
      screen = <Home onNew={() => go('#/nouvelle')} onOpen={(id) => go(`#/partie/${id}`)} onIntro={() => setShowIntro(true)} onTutorial={tutorial} />;
  }

  return (
    <>
      {screen}
      <AnimatePresence>
        {showIntro && (
          <Suspense key="intro" fallback={null}>
            <IntroVideo onClose={() => setShowIntro(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
}
