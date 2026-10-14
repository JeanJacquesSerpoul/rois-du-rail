import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { cityName } from '../../shared/engine';
import type { GameMap } from '../../shared/maps';
import { useT } from '../lib/i18n';
import { useFocusTrap } from '../lib/useFocusTrap';

interface TicketCardProps {
  map: GameMap;
  id: number;
  done?: boolean;
  selected?: boolean;
  onClick?: () => void;
  points?: number;
}

export function TicketCard({ map, id, done, selected, onClick, points }: TicketCardProps) {
  const { t, lang } = useT();
  const ticket = map.ticketById[id];
  const a = map.cityById[ticket.a];
  const b = map.cityById[ticket.b];
  const Tag = onClick ? motion.button : motion.div;
  // épaisseurs de la mini-carte proportionnelles à la taille de la carte
  const k = map.width / 935;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ticket ${done ? 'ticket--done' : ''} ${selected ? 'ticket--selected' : ''}`}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      layout
    >
      <svg viewBox={`0 0 ${map.width} ${map.height}`} className="ticket__map" aria-hidden>
        <rect width={map.width} height={map.height} fill="#cfe0e0" />
        {map.neighborPaths.map((d, i) => (
          <path key={`n${i}`} d={d} fill="#e6dcc3" />
        ))}
        {map.landPaths.map((d, i) => (
          <path key={`l${i}`} d={d} fill="#f6ebcf" stroke="#8a6d3b" strokeWidth={8 * k} />
        ))}
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#a8122a"
          strokeWidth={14 * k}
          strokeDasharray={`${28 * k} ${18 * k}`}
          strokeLinecap="round"
        />
        <circle cx={a.x} cy={a.y} r={34 * k} fill="#a8122a" stroke="#fff" strokeWidth={10 * k} />
        <circle cx={b.x} cy={b.y} r={34 * k} fill="#a8122a" stroke="#fff" strokeWidth={10 * k} />
      </svg>
      <div className="ticket__body">
        <span className="ticket__cities">
          {cityName(map, a.id, lang)}
          <span className="ticket__arrow">⟶</span>
          {cityName(map, b.id, lang)}
        </span>
        <span className={`ticket__points ${points !== undefined && points < 0 ? 'is-negative' : ''}`}>
          {points !== undefined ? (points > 0 ? `+${points}` : points) : ticket.points}
        </span>
      </div>
      {done && <span className="ticket__stamp">{t('tickets.stamp')}</span>}
    </Tag>
  );
}

interface PickerProps {
  map: GameMap;
  offered: number[];
  min: number;
  onConfirm: (keep: number[]) => void;
  busy: boolean;
  onPreview: (cities: string[]) => void;
  /** Conseil du chef de gare : billets à garder et explications. */
  onAdvice?: () => { keep: number[]; reasons: string[] };
}

export function TicketPicker({ map, offered, min, onConfirm, busy, onPreview, onAdvice }: PickerProps) {
  const { t } = useT();
  const [keep, setKeep] = useState<number[]>(offered);
  const [advice, setAdvice] = useState<string[] | null>(null);
  const cities = (ids: number[]) => ids.flatMap((k) => [map.ticketById[k].a, map.ticketById[k].b]);
  const toggle = (id: number) => {
    const next = keep.includes(id) ? keep.filter((k) => k !== id) : [...keep, id];
    setKeep(next);
    onPreview(cities(next));
  };
  const ok = keep.length >= Math.min(min, offered.length);
  return (
    <Sheet title={t('picker.title')} subtitle={t('picker.subtitle', { n: min })}>
      {onAdvice && (
        <div className="picker-advice">
          {advice ? (
            <motion.ul className="picker-advice__list" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <li className="picker-advice__who">{t('picker.adviceWho')}</li>
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
                onPreview(cities(a.keep));
              }}
            >
              {t('picker.askAdvice')}
            </button>
          )}
        </div>
      )}
      <div className="ticket-grid">
        {offered.map((id) => (
          <div key={id} className={`ticket-choice ${keep.includes(id) ? 'is-on' : ''}`}>
            <TicketCard map={map} id={id} onClick={() => toggle(id)} selected={keep.includes(id)} />
            <span className="ticket-choice__check">{keep.includes(id) ? '✓' : ''}</span>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--primary btn--block" disabled={!ok || busy} onClick={() => onConfirm(keep)}>
        {t('picker.keep', { n: keep.length })}
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
  const { t } = useT();
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
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
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
