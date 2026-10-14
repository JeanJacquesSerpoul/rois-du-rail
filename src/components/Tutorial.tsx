import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { GameState } from '../../shared/types';
import { useT } from '../lib/i18n';

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
  /** Clé de traduction : `tutorial.<id>.title` et `tutorial.<id>.text`. */
  id: 'tickets' | 'draw' | 'wait' | 'plans' | 'claim' | 'advisor' | 'end';
  done?: (c: CoachContext, since: number) => boolean;
}

const mine = (c: CoachContext, since: number, kinds: string[]) =>
  c.state.events.some((e) => e.seq > since && e.seat === c.viewer && kinds.includes(e.kind));

const STEPS: Step[] = [
  { id: 'tickets', done: (c) => c.state.phase !== 'setup' },
  { id: 'draw', done: (c, since) => mine(c, since, ['drawFaceUp', 'drawDeck']) && c.state.current !== c.viewer },
  { id: 'wait', done: (c) => c.myTurn },
  { id: 'plans', done: (c) => c.plansShown },
  { id: 'claim', done: (c, since) => mine(c, since, ['claimRoute']) },
  { id: 'advisor', done: (c) => c.adviceOpened },
  { id: 'end' },
];

export function Coach(ctx: CoachContext & { gameId: number }) {
  const { t } = useT();
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
        aria-label={collapsed ? t('tutorial.expand') : t('tutorial.collapse')}
      >
        🧑‍✈️
      </button>
      {!collapsed && (
        <div className="coach__body">
          <div className="coach__head">
            <b>{t(`tutorial.${step.id}.title`)}</b>
            <span>{t('tutorial.step', { n: saved.step + 1, total: STEPS.length })}</span>
          </div>
          <p>{t(`tutorial.${step.id}.text`)}</p>
          <div className="coach__actions">
            {step.done ? (
              <button type="button" className="coach__link" onClick={finish}>
                {t('tutorial.quit')}
              </button>
            ) : (
              <button type="button" className="btn btn--primary coach__done" onClick={finish}>
                {t('tutorial.finish')}
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
