import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { GameState, PlayerResult } from '../../shared/types';
import { music } from '../lib/music';
import { getPref } from '../lib/prefs';
import { playSfx } from '../lib/sfx';
import { PLAYER_FILL, PLAYER_LIGHT } from '../lib/theme';
import { useT } from '../lib/i18n';
import { WagonIcon } from './TrainCard';

/**
 * Séquence de fin de partie : arrivée en gare « Terminus ! », podium où les scores
 * défilent du dernier au premier, puis sacre du vainqueur (rayons, couronne, feux d'artifice).
 */

type Phase = 'terminus' | 'podium' | 'winner';

const FIREWORK_COLORS = ['#ffd84a', '#ff8a9b', '#8fb4ff', '#86e0b4', '#d4a8ff', '#ffffff'];

function Firework({ x, y, delay, color }: { x: string; y: string; delay: number; color: string }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2;
        const dist = 70 + Math.random() * 60;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
      }),
    [],
  );
  return (
    <div className="fw" style={{ left: x, top: y }} aria-hidden>
      <motion.span
        className="fw__flash"
        style={{ background: color }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.6, 0], opacity: [0, 0.9, 0] }}
        transition={{ delay, duration: 0.6, repeat: Infinity, repeatDelay: 1.9 }}
      />
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="fw__spark"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
          animate={{ x: [0, s.dx], y: [0, s.dy + 30], opacity: [0, 1, 0], scale: [1, 1, 0.3] }}
          transition={{ delay, duration: 1.4, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.1 }}
        />
      ))}
    </div>
  );
}

function CountUp({ to, delay, duration }: { to: number; delay: number; duration: number }) {
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => Math.round(v));
  useEffect(() => {
    const ctrl = animate(value, to, { delay, duration, ease: 'easeOut' });
    return () => ctrl.stop();
  }, [value, to, delay, duration]);
  return <motion.span>{rounded}</motion.span>;
}

export function EndCinematic({ state, onDone }: { state: GameState; onDone: () => void }) {
  const { t } = useT();
  const title = t('cine.title');
  const results = state.results ?? [];
  const [phase, setPhase] = useState<Phase>('terminus');

  // ordre du podium : 2e, 1er, 3e, 4e, 5e (le vainqueur au centre)
  const ranked = useMemo(() => [...results].sort((a, b) => a.rank - b.rank || b.total - a.total), [results]);
  const podium = useMemo(() => {
    const [first, second, ...rest] = ranked;
    return [second, first, ...rest].filter((r): r is PlayerResult => !!r);
  }, [ranked]);
  const maxScore = Math.max(1, ...results.map((r) => r.total));
  const winners = ranked.filter((r) => r.rank === 1);
  const winnerNames = winners.map((r) => state.players[r.seat].name).join(t('common.and'));

  // ordre de révélation : du dernier au premier
  const revealOrder = useMemo(() => [...ranked].reverse().map((r) => r.seat), [ranked]);
  const STEP = 0.7;
  const podiumDuration = revealOrder.length * STEP + 1.6;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('podium'), 2600);
    const t2 = setTimeout(
      () => {
        setPhase('winner');
        if (music.playing) music.fanfare();
        else if (getPref('sfx')) playSfx('fanfare');
      },
      2600 + podiumDuration * 1000,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [podiumDuration]);

  return (
    <motion.div
      className="cine"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label={t('cine.label')}
    >
      <div className="cine__rays" data-on={phase === 'winner'} aria-hidden />

      <button type="button" className="cine__skip" onClick={onDone}>
        {phase === 'winner' ? t('cine.details') : t('common.skip')} ›
      </button>

      <AnimatePresence>
        {phase === 'terminus' && (
          <motion.div key="terminus" className="cine__terminus" exit={{ opacity: 0, scale: 1.15 }} transition={{ duration: 0.4 }}>
            <h2 className="cine__title" aria-label={title}>
              {title.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  initial={{ y: -120, opacity: 0, rotate: -20 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.9 + i * 0.06, type: 'spring', stiffness: 380, damping: 14 }}
                >
                  {ch === ' ' ? ' ' : ch}
                </motion.span>
              ))}
            </h2>
            <motion.p className="cine__subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }}>
              {t('cine.subtitle')}
            </motion.p>
            <div className="cine__rail" />
            <motion.div
              className="cine__train"
              initial={{ x: '-100%' }}
              animate={{ x: '120vw' }}
              transition={{ duration: 2.2, ease: [0.5, 0, 0.3, 1] }}
            >
              {state.players.map((p) => (
                <span key={p.color} className="cine__car">
                  <WagonIcon color={PLAYER_FILL[p.color]} />
                </span>
              ))}
              <span className="cine__car cine__car--loco">
                <WagonIcon loco color="#f3e9d2" />
              </span>
            </motion.div>
          </motion.div>
        )}

        {phase !== 'terminus' && (
          <motion.div key="podium" className="cine__podium-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AnimatePresence>
              {phase === 'winner' && (
                <motion.div
                  className="cine__winner"
                  initial={{ y: -40, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                >
                  <span className="cine__winner-kicker">{winners.length > 1 ? t('cine.tie') : t('cine.king')}</span>
                  <span className="cine__winner-name">{winnerNames}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="cine__podium">
              {podium.map((r) => {
                const p = state.players[r.seat];
                const order = revealOrder.indexOf(r.seat);
                const delay = 0.3 + order * STEP;
                const height = 18 + (r.total / maxScore) * 62;
                const isWinner = r.rank === 1;
                return (
                  <div
                    key={r.seat}
                    className={`cine__col ${isWinner ? 'is-winner' : ''}`}
                    style={{ ['--pc' as string]: PLAYER_FILL[p.color], ['--pl' as string]: PLAYER_LIGHT[p.color] }}
                  >
                    <motion.div
                      className="cine__avatar"
                      initial={{ y: 30, opacity: 0, scale: 0.5 }}
                      animate={{ y: 0, opacity: 1, scale: isWinner && phase === 'winner' ? 1.25 : 1 }}
                      transition={{ delay: phase === 'winner' ? 0 : delay + 0.9, type: 'spring', stiffness: 260, damping: 13 }}
                    >
                      {isWinner && phase === 'winner' && (
                        <motion.span
                          className="cine__crown"
                          initial={{ y: -80, opacity: 0, rotate: -30 }}
                          animate={{ y: 0, opacity: 1, rotate: 0 }}
                          transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 10 }}
                        >
                          👑
                        </motion.span>
                      )}
                      {p.isBot ? '🤖' : p.name.slice(0, 1).toUpperCase()}
                    </motion.div>
                    <span className="cine__name">{p.name}</span>
                    <span className="cine__score">
                      <CountUp to={r.total} delay={delay} duration={1.1} />
                    </span>
                    <motion.div
                      className="cine__bar"
                      initial={{ height: '0%' }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay, duration: 1.1, ease: [0.2, 0.9, 0.3, 1] }}
                    >
                      <span className="cine__rank">{r.rank}</span>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {phase === 'winner' && (
              <>
                {[
                  ['18%', '22%', 0],
                  ['80%', '18%', 0.5],
                  ['50%', '10%', 1],
                  ['30%', '40%', 1.4],
                  ['70%', '42%', 1.8],
                ].map(([x, y, d], i) => (
                  <Firework
                    key={i}
                    x={x as string}
                    y={y as string}
                    delay={d as number}
                    color={FIREWORK_COLORS[i % FIREWORK_COLORS.length]}
                  />
                ))}
                <motion.button
                  type="button"
                  className="btn btn--primary cine__cta"
                  onClick={onDone}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  {t('cine.results')}
                </motion.button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
