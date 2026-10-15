import { AnimatePresence } from 'motion/react';
import { Suspense, lazy, useEffect, useState } from 'react';
import type { MapId } from '../shared/maps';
import type { PlayerConfig } from '../shared/types';
import { Game } from './components/Game';
import { RoomScreen } from './components/Room';
import { Home, Setup } from './components/Screens';
import { startTutorial } from './components/Tutorial';
import { api } from './lib/api';
import { currentT } from './lib/i18n';
import { introSeen } from './lib/intro';
import { createRoom } from './lib/online';

// présentation chargée à la demande (première visite ou bouton de l'accueil)
const IntroVideo = lazy(() => import('./components/IntroVideo').then((m) => ({ default: m.IntroVideo })));

type Route =
  | { name: 'home' }
  | { name: 'setup'; online?: boolean }
  | { name: 'game'; id: number }
  | { name: 'room'; code: string };

function parseHash(): Route {
  const m = location.hash.match(/^#\/partie\/(\d+)/);
  if (m) return { name: 'game', id: Number(m[1]) };
  const room = location.hash.match(/^#\/salon\/([A-Za-z0-9]{6})/);
  if (room) return { name: 'room', code: room[1].toUpperCase() };
  if (location.hash === '#/nouvelle') return { name: 'setup' };
  if (location.hash === '#/nouveau-salon') return { name: 'setup', online: true };
  return { name: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  // présentation animée à la toute première ouverture (sauf arrivée par un lien d'invitation),
  // puis sur demande depuis l'accueil
  const [showIntro, setShowIntro] = useState(() => !introSeen() && parseHash().name !== 'room');

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (hash: string) => {
    location.hash = hash;
  };

  const start = async (players: PlayerConfig[], mapId: MapId, online: boolean) => {
    if (online) return go(`#/salon/${await createRoom(players, mapId)}`);
    const { id } = await api.createGame(players, mapId);
    go(`#/partie/${id}`);
  };

  /** Partie guidée : une vraie partie contre un ordinateur facile, commentée par le chef de gare. */
  const tutorial = async () => {
    let name = currentT()('setup.you');
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
      screen = <Setup key={String(route.online)} initialOnline={route.online} onStart={start} onBack={() => go('#/')} />;
      break;
    case 'game':
      screen = <Game key={route.id} id={route.id} onExit={() => go('#/')} onNewGame={() => go('#/nouvelle')} />;
      break;
    case 'room':
      screen = <RoomScreen key={route.code} code={route.code} onExit={() => go('#/')} onNewGame={() => go('#/nouvelle')} />;
      break;
    default:
      screen = (
        <Home
          onNew={() => go('#/nouvelle')}
          onNewOnline={() => go('#/nouveau-salon')}
          onOpen={(id) => go(`#/partie/${id}`)}
          onRoom={(code) => go(`#/salon/${code}`)}
          onIntro={() => setShowIntro(true)}
          onTutorial={tutorial}
        />
      );
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
