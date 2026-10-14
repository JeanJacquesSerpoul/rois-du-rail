import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useFocusTrap } from '../lib/useFocusTrap';
import { CITY_BY_ID, FRANCE_PATH, MAP_HEIGHT, MAP_WIDTH, NEIGHBOR_PATHS, TICKET_BY_ID } from '../../shared/map';

interface TicketCardProps {
  id: number;
  done?: boolean;
  selected?: boolean;
  onClick?: () => void;
  points?: number;
}

export function TicketCard({ id, done, selected, onClick, points }: TicketCardProps) {
  const t = TICKET_BY_ID[id];
  const a = CITY_BY_ID[t.a];
  const b = CITY_BY_ID[t.b];
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ticket ${done ? 'ticket--done' : ''} ${selected ? 'ticket--selected' : ''}`}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      layout
    >
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="ticket__map" aria-hidden>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#cfe0e0" />
        {NEIGHBOR_PATHS.map((d, i) => (
          <path key={i} d={d} fill="#e6dcc3" />
        ))}
        <path d={FRANCE_PATH} fill="#f6ebcf" stroke="#8a6d3b" strokeWidth="8" />
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#a8122a"
          strokeWidth="14"
          strokeDasharray="28 18"
          strokeLinecap="round"
        />
        <circle cx={a.x} cy={a.y} r="34" fill="#a8122a" stroke="#fff" strokeWidth="10" />
        <circle cx={b.x} cy={b.y} r="34" fill="#a8122a" stroke="#fff" strokeWidth="10" />
      </svg>
      <div className="ticket__body">
        <span className="ticket__cities">
          {a.name}
          <span className="ticket__arrow">⟶</span>
          {b.name}
        </span>
        <span className={`ticket__points ${points !== undefined && points < 0 ? 'is-negative' : ''}`}>
          {points !== undefined ? (points > 0 ? `+${points}` : points) : t.points}
        </span>
      </div>
      {done && <span className="ticket__stamp">Réalisé</span>}
    </Tag>
  );
}

interface PickerProps {
  offered: number[];
  min: number;
  onConfirm: (keep: number[]) => void;
  busy: boolean;
  onPreview: (cities: string[]) => void;
  /** Conseil du chef de gare : billets à garder et explications. */
  onAdvice?: () => { keep: number[]; reasons: string[] };
}

export function TicketPicker({ offered, min, onConfirm, busy, onPreview, onAdvice }: PickerProps) {
  const [keep, setKeep] = useState<number[]>(offered);
  const [advice, setAdvice] = useState<string[] | null>(null);
  const toggle = (id: number) => {
    const next = keep.includes(id) ? keep.filter((k) => k !== id) : [...keep, id];
    setKeep(next);
    onPreview(next.flatMap((k) => [TICKET_BY_ID[k].a, TICKET_BY_ID[k].b]));
  };
  const ok = keep.length >= Math.min(min, offered.length);
  return (
    <Sheet
      title="Choisissez vos destinations"
      subtitle={`Gardez-en au moins ${min}. Les destinations non réalisées coûtent leurs points en fin de partie.`}
    >
      {onAdvice && (
        <div className="picker-advice">
          {advice ? (
            <motion.ul className="picker-advice__list" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <li className="picker-advice__who">🧑‍✈️ Le chef de gare :</li>
              {advice.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </motion.ul>
          ) : (
            <button
              type="button"
              className="chip-btn picker-advice__btn"
              onClick={() => {
                const a = onAdvice();
                setKeep(a.keep);
                setAdvice(a.reasons);
                onPreview(a.keep.flatMap((k) => [TICKET_BY_ID[k].a, TICKET_BY_ID[k].b]));
              }}
            >
              🧑‍✈️ Demander conseil au chef de gare
            </button>
          )}
        </div>
      )}
      <div className="ticket-grid">
        {offered.map((id) => (
          <div key={id} className={`ticket-choice ${keep.includes(id) ? 'is-on' : ''}`}>
            <TicketCard id={id} onClick={() => toggle(id)} selected={keep.includes(id)} />
            <span className="ticket-choice__check">{keep.includes(id) ? '✓' : ''}</span>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--primary btn--block" disabled={!ok || busy} onClick={() => onConfirm(keep)}>
        Garder {keep.length} destination{keep.length > 1 ? 's' : ''}
      </button>
    </Sheet>
  );
}

export function Sheet({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={ref}
        tabIndex={-1}
        aria-modal="true"
        className="sheet"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">{title}</h2>
            {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          )}
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export { AnimatePresence };
