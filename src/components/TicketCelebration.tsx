import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { mapOf } from '../../shared/engine';
import { useT } from '../lib/i18n';
import type { GameState } from '../../shared/types';
import { PLAYER_FILL } from '../lib/theme';
import { TicketCard } from './Tickets';

const SHOW_MS = 2800;

/** Bandeau « Billet réalisé ! » quand un joueur humain relie une destination. */
export function TicketCelebration({
  item,
  state,
  onDone,
}: {
  item: { seat: number; ticketId: number } | null;
  state: GameState;
  onDone: () => void;
}) {
  const { t } = useT();
  const map = mapOf(state);
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(timer);
  }, [item, onDone]);

  const player = item ? state.players[item.seat] : null;
  return (
    <AnimatePresence>
      {item && player && (
        <motion.div
          key={`${item.seat}-${item.ticketId}`}
          className="celebrate"
          style={{ ['--pc' as string]: PLAYER_FILL[player.color] }}
          initial={{ opacity: 0, y: -30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          role="status"
        >
          <span className="celebrate__title">
            {t('celebrate.title')} <b>+{map.ticketById[item.ticketId].points}</b>
          </span>
          <div className="celebrate__ticket">
            <TicketCard map={map} id={item.ticketId} done />
            <motion.span
              className="celebrate__stamp"
              aria-hidden
              initial={{ scale: 2.6, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: -12, opacity: 1 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 500, damping: 14 }}
            >
              ✓
            </motion.span>
          </div>
          <span className="celebrate__who">{player.name}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
