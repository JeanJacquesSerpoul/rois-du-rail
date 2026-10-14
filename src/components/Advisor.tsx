import { motion } from 'motion/react';
import type { Advice } from '../../shared/advisor';
import { Sheet } from './Tickets';

interface Props {
  advice: Advice;
  busy: boolean;
  onFollow: () => void;
  onClose: () => void;
}

/** Fenêtre du chef de gare : le conseil, ses raisons et l'état des billets. */
export function AdvisorSheet({ advice, busy, onFollow, onClose }: Props) {
  return (
    <Sheet title="Le chef de gare" onClose={onClose}>
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
            <h3>Vos destinations</h3>
            <ul>
              {advice.tickets.map((t) => (
                <li key={t.id} className={`advisor__ticket advisor__ticket--${t.state}`}>
                  <span>{t.label}</span>
                  <span>
                    {t.state === 'done' && `✓ réalisée (+${t.points})`}
                    {t.state === 'open' && `encore ~${t.missing} wagon${t.missing! > 1 ? 's' : ''}`}
                    {t.state === 'blocked' && `✗ bloquée (−${t.points})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="advisor__note">Le conseil apparaît aussi en surbrillance sur la carte. Libre à vous de le suivre !</p>
        <div className="advisor__actions">
          <button type="button" className="btn" onClick={onClose}>
            Je décide
          </button>
          <button type="button" className="btn btn--primary" onClick={onFollow} disabled={busy}>
            Suivre le conseil
          </button>
        </div>
      </div>
    </Sheet>
  );
}
