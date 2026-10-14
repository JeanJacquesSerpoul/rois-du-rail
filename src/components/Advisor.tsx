import { motion } from 'motion/react';
import type { Advice } from '../../shared/advisor';
import { useT } from '../lib/i18n';
import { Sheet } from './Tickets';

interface Props {
  advice: Advice;
  busy: boolean;
  onFollow: () => void;
  onClose: () => void;
}

/** Fenêtre du chef de gare : le conseil, ses raisons et l'état des billets. */
export function AdvisorSheet({ advice, busy, onFollow, onClose }: Props) {
  const { t } = useT();
  return (
    <Sheet title={t('advisor.title')} onClose={onClose}>
      <div className="advisor">
        <div className="advisor__speech">
          <motion.span
            className="advisor__avatar"
            aria-hidden
            initial={{ rotate: -12, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12 }}
          >
            🧑‍✈️
          </motion.span>
          <motion.div
            className="advisor__bubble"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="advisor__headline">{advice.headline}</p>
            <ul className="advisor__reasons">
              {advice.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </motion.div>
        </div>

        {advice.warnings.length > 0 && (
          <ul className="advisor__warnings">
            {advice.warnings.map((w) => (
              <li key={w}>⚠️ {w}</li>
            ))}
          </ul>
        )}

        {advice.tickets.length > 0 && (
          <div className="advisor__tickets">
            <h3>{t('tickets.title')}</h3>
            <ul>
              {advice.tickets.map((ticket) => (
                <li key={ticket.id} className={`advisor__ticket advisor__ticket--${ticket.state}`}>
                  <span>{ticket.label}</span>
                  <span>
                    {ticket.state === 'done' && t('advisor.done', { pts: ticket.points })}
                    {ticket.state === 'open' && t('advisor.open', { n: ticket.missing ?? 0 })}
                    {ticket.state === 'blocked' && t('advisor.blocked', { pts: ticket.points })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="advisor__note">{t('advisor.note')}</p>
        <div className="advisor__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('advisor.decide')}
          </button>
          <button type="button" className="btn btn--primary" onClick={onFollow} disabled={busy}>
            {t('advisor.follow')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
