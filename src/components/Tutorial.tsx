import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { GameState } from '../../shared/types';

/**
 * Partie guidée : le chef de gare accompagne une vraie partie, étape par étape.
 * Chaque étape se valide toute seule quand le joueur a fait ce qui est demandé.
 */

const KEY = 'rdr.tutorial';

interface TutorialSave {
  gameId: number;
  step: number;
  /** Numéro d'événement au début de l'étape, pour détecter ce qui s'est passé depuis. */
  since: number;
}

function load(): TutorialSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TutorialSave) : null;
  } catch {
    return null;
  }
}

function save(v: TutorialSave | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le tutoriel vaut pour cette visite */
  }
}

/** Démarre la partie guidée pour cette partie. */
export function startTutorial(gameId: number) {
  save({ gameId, step: 0, since: 0 });
}

export function isTutorialGame(gameId: number): boolean {
  return load()?.gameId === gameId;
}

export interface CoachContext {
  state: GameState;
  viewer: number;
  myTurn: boolean;
  plansShown: boolean;
  adviceOpened: boolean;
}

interface Step {
  title: string;
  text: string;
  done?: (c: CoachContext, since: number) => boolean;
}

const mine = (c: CoachContext, since: number, kinds: string[]) =>
  c.state.events.some((e) => e.seq > since && e.seat === c.viewer && kinds.includes(e.kind));

const STEPS: Step[] = [
  {
    title: 'Vos destinations',
    text: 'Bienvenue ! Chaque billet relie deux villes. Gardez-en au moins 2 : un billet réalisé rapporte ses points, sinon il les fait perdre. Essayez « Demander conseil au chef de gare ».',
    done: (c) => c.state.phase !== 'setup',
  },
  {
    title: 'Piocher des cartes',
    text: 'À votre tour, prenez 2 cartes Wagon : touchez une carte visible du marché ou la pioche cachée (le paquet bleu).',
    done: (c, since) => mine(c, since, ['drawFaceUp', 'drawDeck']) && c.state.current !== c.viewer,
  },
  {
    title: 'Le tour des autres',
    text: 'L’ordinateur joue à son tour : ses actions s’affichent en haut de l’écran. Patientez un instant…',
    done: (c) => c.myTurn,
  },
  {
    title: 'Vos trajets',
    text: 'Touchez « 🎫 Trajets » en bas de la carte : le chemin conseillé pour chaque destination s’affiche en pointillés dorés.',
    done: (c) => c.plansShown,
  },
  {
    title: 'Prendre une route',
    text: 'Quand vous avez assez de cartes de la bonne couleur, une route scintille : touchez-la puis choisissez comment payer. Pas encore ? Piochez de nouveau.',
    done: (c, since) => mine(c, since, ['claimRoute']),
  },
  {
    title: 'Le chef de gare',
    text: 'Bravo, première route posée ! Si vous hésitez, touchez « 🧑‍✈️ Chef de gare » : je vous propose un coup et je vous explique pourquoi.',
    done: (c) => c.adviceOpened,
  },
  {
    title: 'À vous de jouer',
    text: 'Vous connaissez l’essentiel ! Reliez vos destinations avant que les wagons ne s’épuisent : quand un joueur n’en a plus que 2, chacun joue un dernier tour. Bonne route !',
  },
];

export function Coach(ctx: CoachContext & { gameId: number }) {
  const [saved, setSaved] = useState<TutorialSave | null>(() => load());
  const [collapsed, setCollapsed] = useState(false);
  const active = saved && saved.gameId === ctx.gameId && saved.step < STEPS.length;
  const step = active ? STEPS[saved.step] : null;

  // validation automatique de l'étape en cours
  useEffect(() => {
    if (!active || !step?.done) return;
    if (step.done(ctx, saved.since)) {
      const next = { ...saved, step: saved.step + 1, since: ctx.state.eventSeq };
      save(next);
      setSaved(next);
      setCollapsed(false);
    }
  });

  const finish = () => {
    save(null);
    setSaved(null);
  };

  if (!active || !step || ctx.state.phase === 'finished') return null;
  return (
    // une bulle par étape (clé), sans animation de sortie : rien ne s'empile pendant les transitions
    <motion.div
      key={saved.step}
      className={`coach ${collapsed ? 'is-collapsed' : ''}`}
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="coach__avatar"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Afficher le conseil' : 'Réduire le conseil'}
      >
        🧑‍✈️
      </button>
      {!collapsed && (
        <div className="coach__body">
          <div className="coach__head">
            <b>{step.title}</b>
            <span>
              Étape {saved.step + 1}/{STEPS.length}
            </span>
          </div>
          <p>{step.text}</p>
          <div className="coach__actions">
            {step.done ? (
              <button type="button" className="coach__link" onClick={finish}>
                Quitter la partie guidée
              </button>
            ) : (
              <button type="button" className="btn btn--primary coach__done" onClick={finish}>
                Terminer la partie guidée
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
