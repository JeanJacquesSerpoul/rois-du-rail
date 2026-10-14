import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CITY_BY_ID, FRANCE_PATH, MAP_HEIGHT, MAP_WIDTH, ROUTES, TICKETS } from '../../shared/map';
import type { CardColor } from '../../shared/types';
import { markIntroSeen as markSeen } from '../lib/intro';
import { setPref, usePref } from '../lib/prefs';
import { useFocusTrap } from '../lib/useFocusTrap';
import { CARD_FILL, PLAYER_FILL, ROUTE_FILL } from '../lib/theme';
import { TicketCard } from './Tickets';
import { TrainCard, WagonIcon } from './TrainCard';

/**
 * Présentation du jeu en motion design, jouée comme une vidéo : chapitres animés,
 * sous-titres, voix off (synthèse vocale du navigateur) et contrôles de lecture.
 */

// ---------------------------------------------------------------- scènes

function SceneTitle() {
  return (
    <div className="iv-scene iv-title">
      <motion.p className="iv-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        Compagnie des chemins de fer de France
      </motion.p>
      <motion.h2
        className="iv-logo"
        initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.4 }}
      >
        Rois <span>du</span> Rail
      </motion.h2>
      <div className="iv-rail" />
      <motion.div
        className="iv-convoy"
        initial={{ x: '-120%' }}
        animate={{ x: '0%' }}
        transition={{ duration: 2.6, ease: [0.2, 0.8, 0.3, 1], delay: 0.8 }}
      >
        {['#1c3f8f', '#16704a', '#dd8f0b', '#a8122a'].map((c) => (
          <span key={c} className="iv-car">
            <WagonIcon color={c} />
          </span>
        ))}
        <span className="iv-car iv-car--loco">
          <WagonIcon loco color="#f3e9d2" />
        </span>
      </motion.div>
    </div>
  );
}

const MAP_CITIES = ['bre', 'lil', 'str', 'par', 'nts', 'lyo', 'bdx', 'tls', 'mrs', 'nic', 'dij', 'ren'];
const MAP_ROUTE_IDS = ROUTES.filter((r) =>
  [
    ['par', 'lyo'],
    ['bdx', 'tls'],
    ['ren', 'nts'],
    ['mrs', 'nic'],
    ['par', 'dij'],
  ].some(([a, b]) => (r.a === a && r.b === b) || (r.a === b && r.b === a)),
).filter((r, i, all) => all.findIndex((o) => o.a === r.a && o.b === r.b) === i);

function SceneMap() {
  return (
    <div className="iv-scene iv-split">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="iv-map" aria-hidden>
        <motion.path
          d={FRANCE_PATH}
          fill="#f6ebcf"
          stroke="#c9a227"
          strokeWidth="6"
          initial={{ pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 1 }}
          transition={{ pathLength: { duration: 1.8 }, fillOpacity: { delay: 1.2, duration: 0.8 } }}
        />
        {MAP_ROUTE_IDS.map((r, i) => {
          const a = CITY_BY_ID[r.a];
          const b = CITY_BY_ID[r.b];
          return (
            <motion.line
              key={r.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={ROUTE_FILL[r.color]}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray="34 10"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 2.4 + i * 0.35, duration: 0.6 }}
            />
          );
        })}
        {MAP_CITIES.map((id, i) => {
          const c = CITY_BY_ID[id];
          return (
            <motion.circle
              key={id}
              cx={c.x}
              cy={c.y}
              r="16"
              fill="#a8122a"
              stroke="#fff"
              strokeWidth="6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              transition={{ delay: 1.4 + i * 0.08, type: 'spring', stiffness: 400, damping: 12 }}
            />
          );
        })}
      </svg>
      <div className="iv-side">
        <motion.div className="iv-big" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          🎯 Le but
        </motion.div>
        <motion.p className="iv-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          Relier les villes de France avec vos trains et marquer <b>le plus de points</b>.
        </motion.p>
      </div>
    </div>
  );
}

const FAN: CardColor[] = ['red', 'blue', 'yellow', 'green', 'loco'];

function SceneCards() {
  return (
    <div className="iv-scene iv-center">
      <motion.div className="iv-step" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Action 1 · Piocher 2 cartes
      </motion.div>
      <div className="iv-fan">
        {FAN.map((c, i) => (
          <motion.div
            key={c}
            className={`iv-fan__card ${c === 'loco' ? 'is-loco' : ''}`}
            initial={{ y: 160, rotate: 0, opacity: 0 }}
            animate={{ y: c === 'loco' ? -18 : 0, rotate: (i - 2) * 9, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.25, type: 'spring', stiffness: 200, damping: 16 }}
          >
            <TrainCard color={c} size="lg" />
          </motion.div>
        ))}
      </div>
      <motion.div className="iv-callout" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.4, type: 'spring' }}>
        🌈 La locomotive remplace n'importe quelle couleur
      </motion.div>
    </div>
  );
}

function SceneClaim() {
  const slots = 4;
  return (
    <div className="iv-scene iv-center">
      <motion.div className="iv-step" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Action 2 · Prendre une route
      </motion.div>
      <div className="iv-route">
        <span className="iv-city">Paris</span>
        <div className="iv-slots">
          {Array.from({ length: slots }, (_, i) => (
            <div key={i} className="iv-slot" style={{ background: CARD_FILL.yellow }}>
              <motion.div
                className="iv-slot__wagon"
                style={{ background: PLAYER_FILL.navy }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 2.6 + i * 0.15, type: 'spring', stiffness: 300, damping: 14 }}
              />
            </div>
          ))}
        </div>
        <span className="iv-city">Dijon</span>
      </div>
      <div className="iv-pay">
        {Array.from({ length: slots }, (_, i) => (
          <motion.div
            key={i}
            className="iv-pay__card"
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [40, 0, 0, -60], opacity: [0, 1, 1, 0] }}
            transition={{ delay: 0.5 + i * 0.15, duration: 2.2, times: [0, 0.25, 0.7, 1] }}
          >
            <TrainCard color={i === 3 ? 'loco' : 'yellow'} size="md" />
          </motion.div>
        ))}
      </div>
      <motion.div className="iv-points" initial={{ opacity: 0, scale: 0.3, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 3.4, type: 'spring' }}>
        +7 points
      </motion.div>
    </div>
  );
}

const POINTS: [number, number][] = [
  [1, 1],
  [2, 2],
  [3, 4],
  [4, 7],
  [5, 10],
  [6, 15],
];

function ScenePoints() {
  return (
    <div className="iv-scene iv-center">
      <motion.div className="iv-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Plus la route est longue, plus elle rapporte
      </motion.div>
      <div className="iv-bars">
        {POINTS.map(([len, pts], i) => (
          <div key={len} className="iv-bar">
            <motion.span className="iv-bar__pts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.25 }}>
              {pts}
            </motion.span>
            <motion.div
              className="iv-bar__fill"
              initial={{ height: 0 }}
              animate={{ height: `${(pts / 15) * 100}%` }}
              transition={{ delay: 0.4 + i * 0.25, type: 'spring', stiffness: 120, damping: 16 }}
            />
            <span className="iv-bar__len">
              {Array.from({ length: len }, (_, k) => (
                <i key={k} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="iv-legend">wagons → points</p>
    </div>
  );
}

const DEMO_TICKET = TICKETS.find((t) => t.a === 'par' && t.b === 'nic')!;

function SceneTickets() {
  return (
    <div className="iv-scene iv-center">
      <motion.div className="iv-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Action 3 · Piocher des destinations
      </motion.div>
      <motion.div
        className="iv-ticket"
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <TicketCard id={DEMO_TICKET.id} />
      </motion.div>
      <div className="iv-outcomes">
        <motion.div className="iv-outcome iv-outcome--ok" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2 }}>
          ✓ Villes reliées
          <b>+{DEMO_TICKET.points}</b>
        </motion.div>
        <motion.div className="iv-outcome iv-outcome--ko" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 3.2 }}>
          ✗ Pas reliées
          <b>−{DEMO_TICKET.points}</b>
        </motion.div>
      </div>
    </div>
  );
}

function SceneEnd() {
  const wagons = useMotionValue(45);
  const shown = useTransform(wagons, (v) => Math.round(v));
  useEffect(() => {
    const ctrl = animate(wagons, 2, { duration: 2.6, delay: 0.5, ease: 'easeIn' });
    return () => ctrl.stop();
  }, [wagons]);
  return (
    <div className="iv-scene iv-center">
      <div className="iv-counter">
        <span className="iv-counter__icon">
          <WagonIcon color="#f3e9d2" />
        </span>
        <motion.span className="iv-counter__num">{shown}</motion.span>
        <span className="iv-counter__label">wagons</span>
      </div>
      <motion.div className="iv-banner" initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: -3 }} transition={{ delay: 3.3, type: 'spring', stiffness: 260, damping: 12 }}>
        Dernier tour !
      </motion.div>
      <motion.div className="iv-medal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5 }}>
        🏅 Plus long trajet continu : <b>+10 points</b>
      </motion.div>
    </div>
  );
}

function SceneOutro({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="iv-scene iv-center iv-outro">
      <motion.div className="iv-outro__train" initial={{ x: -200 }} animate={{ x: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
        <span>🚂</span>
      </motion.div>
      <motion.h2 className="iv-logo iv-logo--sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        À vous de jouer !
      </motion.h2>
      <motion.button
        type="button"
        className="btn btn--primary"
        onClick={onFinish}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring' }}
      >
        En voiture !
      </motion.button>
    </div>
  );
}

interface Chapter {
  title: string;
  caption: string;
  render: (finish: () => void) => React.ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    title: 'Bienvenue',
    caption: 'Bienvenue à bord ! Dans Rois du Rail, vous bâtissez votre réseau de chemin de fer à travers la France.',
    render: () => <SceneTitle />,
  },
  {
    title: 'Le but',
    caption: 'Votre but : relier les villes avec vos trains pour marquer le plus de points possible.',
    render: () => <SceneMap />,
  },
  {
    title: 'Les cartes',
    caption:
      'À votre tour, vous faites une seule action. Par exemple, piocher deux cartes Wagon. La locomotive multicolore remplace n’importe quelle couleur.',
    render: () => <SceneCards />,
  },
  {
    title: 'Les routes',
    caption:
      'Pour prendre une route, défaussez autant de cartes de sa couleur que sa longueur. Vos wagons s’y installent et vous marquez des points.',
    render: () => <SceneClaim />,
  },
  {
    title: 'Les points',
    caption: 'Plus la route est longue, plus elle rapporte : une route de six wagons vaut quinze points !',
    render: () => <ScenePoints />,
  },
  {
    title: 'Destinations',
    caption:
      'Les billets de destination rapportent gros si vous reliez les deux villes. Attention : un billet non réalisé fait perdre ses points.',
    render: () => <SceneTickets />,
  },
  {
    title: 'Fin',
    caption:
      'Quand un joueur n’a plus que deux wagons, chacun joue un dernier tour. Le plus long trajet continu gagne dix points de bonus.',
    render: () => <SceneEnd />,
  },
  {
    title: 'À vous',
    caption: 'C’est parti ! Touchez les routes de la carte pour les prendre. Bon voyage !',
    render: (finish) => <SceneOutro onFinish={finish} />,
  },
];

/** Durée d'un chapitre : le temps de lire (ou d'entendre) le sous-titre, avec un minimum. */
const durationOf = (c: Chapter) => Math.max(6, c.caption.length / 14 + 2);
const DURATIONS = CHAPTERS.map(durationOf);
const TOTAL = DURATIONS.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- voix off

function useVoice(enabled: boolean) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!supported) return;
    const pick = () => {
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
      voiceRef.current = voices.find((v) => /natural|google|amélie|thomas|denise|henri/i.test(v.name)) ?? voices[0] ?? null;
    };
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', pick);
      speechSynthesis.cancel();
    };
  }, [supported]);

  const say = useCallback(
    (text: string) => {
      if (!supported) return;
      speechSynthesis.cancel();
      if (!enabled) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = 1.05;
      if (voiceRef.current) u.voice = voiceRef.current;
      speechSynthesis.speak(u);
    },
    [enabled, supported],
  );
  const pause = useCallback(() => supported && speechSynthesis.pause(), [supported]);
  const resume = useCallback(() => supported && speechSynthesis.resume(), [supported]);
  const stop = useCallback(() => supported && speechSynthesis.cancel(), [supported]);
  return { supported, say, pause, resume, stop };
}

// ---------------------------------------------------------------- lecteur

export function IntroVideo({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [elapsed, setElapsed] = useState(0); // secondes écoulées dans le chapitre
  const voiceOn = usePref('introVoice');
  const voice = useVoice(voiceOn);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef); // Échap est déjà géré par le lecteur

  const close = useCallback(() => {
    voice.stop();
    markSeen();
    onClose();
  }, [onClose, voice]);

  const goTo = useCallback(
    (i: number) => {
      setChapter(i);
      setElapsed(0);
      voice.say(CHAPTERS[i].caption);
    },
    [voice],
  );

  // horloge du lecteur (setInterval plutôt que requestAnimationFrame : continue même si l'onglet ralentit)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    if (elapsed < DURATIONS[chapter]) return;
    if (chapter < CHAPTERS.length - 1) goTo(chapter + 1);
    else setPlaying(false); // dernier chapitre : on reste sur « À vous de jouer »
  }, [elapsed, chapter, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === ' ' && started) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const start = () => {
    setStarted(true);
    setPlaying(true);
    goTo(0);
  };

  const togglePlay = () => {
    if (chapter === CHAPTERS.length - 1 && elapsed >= DURATIONS[chapter] - 0.1) {
      setPlaying(true);
      goTo(0);
      return;
    }
    if (playing) voice.pause();
    else voice.resume();
    setPlaying((p) => !p);
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setPref('introVoice', next);
    if (!next) voice.stop();
  };
  // relance la phrase courante quand on réactive la voix
  const prevVoice = useRef(voiceOn);
  useEffect(() => {
    if (voiceOn && !prevVoice.current && playing) voice.say(CHAPTERS[chapter].caption);
    prevVoice.current = voiceOn;
  }, [voiceOn, playing, chapter, voice]);

  const before = useMemo(() => DURATIONS.slice(0, chapter).reduce((a, b) => a + b, 0), [chapter]);
  const remaining = Math.max(0, Math.ceil(TOTAL - before - elapsed));

  return (
    <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        ref={dialogRef}
        className="intro"
        role="dialog"
        aria-modal="true"
        aria-label="Présentation du jeu"
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <div className="intro__head">
          <span className="intro__title">🎬 Découvrir le jeu</span>
          <button type="button" className="intro__skip" onClick={close}>
            {chapter === CHAPTERS.length - 1 ? 'Fermer' : 'Passer'} ✕
          </button>
        </div>

        <div className="intro__stage">
          {started ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={chapter}
                className="intro__frame"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                {CHAPTERS[chapter].render(close)}
              </motion.div>
            </AnimatePresence>
          ) : (
            <button type="button" className="intro__poster" onClick={start}>
              <span className="iv-logo">
                Rois <span>du</span> Rail
              </span>
              <span className="intro__play" aria-hidden>
                ▶
              </span>
              <span className="intro__hint">Les règles en {Math.round(TOTAL / 60)} minute{TOTAL >= 90 ? 's' : ''} · touchez pour lancer</span>
            </button>
          )}
        </div>

        <p className="intro__caption" aria-live="polite">
          {started ? CHAPTERS[chapter].caption : 'Une courte présentation animée pour apprendre à jouer.'}
        </p>

        <div className="intro__controls">
          <button
            type="button"
            className="intro__btn"
            onClick={started ? togglePlay : start}
            aria-label={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <div className="intro__chapters">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.title}
                type="button"
                className="intro__chapter"
                style={{ flexGrow: DURATIONS[i] }}
                onClick={() => {
                  if (!started) setStarted(true);
                  setPlaying(true);
                  goTo(i);
                }}
                aria-label={`Chapitre ${i + 1} : ${c.title}`}
                title={c.title}
              >
                <span
                  className="intro__chapter-fill"
                  style={{
                    width: `${!started || i > chapter ? 0 : i < chapter ? 100 : Math.min(100, (elapsed / DURATIONS[i]) * 100)}%`,
                  }}
                />
              </button>
            ))}
          </div>
          <span className="intro__time">{started ? `-${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : ''}</span>
          {voice.supported && (
            <button
              type="button"
              className={`intro__btn ${voiceOn ? '' : 'is-off'}`}
              onClick={toggleVoice}
              aria-pressed={voiceOn}
              aria-label={voiceOn ? 'Couper la voix off' : 'Activer la voix off'}
              title={voiceOn ? 'Couper la voix off' : 'Activer la voix off'}
            >
              {voiceOn ? '🔊' : '🔈'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
