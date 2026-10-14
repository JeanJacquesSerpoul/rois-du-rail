import { motion } from 'motion/react';
import { useMemo } from 'react';
import type { GameState } from '../../shared/types';
import { PLAYER_FILL } from '../lib/theme';
import { TicketCard } from './Tickets';

const CONFETTI_COLORS = ['#d4473f', '#f1c534', '#3877c4', '#4c9a4a', '#b25599', '#ec8b2e'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 2.5 + Math.random() * 2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  state: GameState;
  onClose: () => void;
  onHome: () => void;
  onNewGame: () => void;
  onReplay?: () => void;
}

export function EndScreen({ state, onClose, onHome, onNewGame, onReplay }: Props) {
  const results = [...(state.results ?? [])].sort((a, b) => a.rank - b.rank);
  const winner = results[0];
  return (
    <motion.div className="end-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Confetti />
      <motion.div
        className="end"
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.15 }}
      >
        <div className="end__trophy">🏆</div>
        <h2 className="end__title">{state.players[winner.seat].name} remporte la partie !</h2>
        <p className="end__subtitle">{winner.total} points</p>

        <div className="end__table">
          {results.map((r, i) => {
            const p = state.players[r.seat];
            return (
              <motion.div
                key={r.seat}
                className="end__row"
                style={{ ['--pc' as string]: PLAYER_FILL[p.color] }}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.15 }}
              >
                <div className="end__rank">{['🥇', '🥈', '🥉'][r.rank - 1] ?? r.rank}</div>
                <div className="end__player">
                  <div className="end__name">
                    {p.name} {p.isBot && '🤖'}
                  </div>
                  <div className="end__breakdown">
                    <span>Routes <b>{r.routePoints}</b></span>
                    <span>
                      Destinations <b className={r.ticketPoints < 0 ? 'neg' : ''}>{r.ticketPoints >= 0 ? `+${r.ticketPoints}` : r.ticketPoints}</b>
                    </span>
                    <span>
                      Plus long trajet <b>{r.longest}</b>
                      {r.longestBonus > 0 && <em> +{r.longestBonus} 🏅</em>}
                    </span>
                  </div>
                  <div className="end__tickets">
                    {r.tickets.map((t) => (
                      <TicketCard key={t.id} id={t.id} done={t.done} points={t.points} />
                    ))}
                  </div>
                </div>
                <div className="end__total">{r.total}</div>
              </motion.div>
            );
          })}
        </div>

        <div className="end__actions">
          {onReplay && (
            <button type="button" className="btn" onClick={onReplay}>
              🎆 Revoir le final
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Voir la carte
          </button>
          <button type="button" className="btn" onClick={onHome}>
            Accueil
          </button>
          <button type="button" className="btn btn--primary" onClick={onNewGame}>
            Rejouer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
