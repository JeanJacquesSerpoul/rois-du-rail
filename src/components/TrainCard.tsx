import { motion } from 'motion/react';
import type { CardColor } from '../../shared/types';
import { CARD_ADJ } from '../../shared/engine';
import { usePref } from '../lib/prefs';
import { CARD_FILL, CARD_INK, COLOR_SYMBOL } from '../lib/theme';

export function WagonIcon({ loco, color = 'currentColor' }: { loco?: boolean; color?: string }) {
  return loco ? (
    <svg viewBox="0 0 56 32" className="wagon-icon" aria-hidden>
      <g fill={color}>
        <rect x="6" y="11" width="30" height="11" rx="5" />
        <rect x="34" y="4" width="15" height="18" rx="2" />
        <rect x="31" y="2" width="21" height="4" rx="1.5" />
        <rect x="11" y="3" width="6" height="9" rx="1" />
        <path d="M2 22h4v-6L2 20z" />
        <rect x="3" y="21" width="50" height="3" rx="1.5" />
      </g>
      <g fill={color} stroke="rgba(0,0,0,.35)" strokeWidth="1.5">
        <circle cx="13" cy="26" r="4" />
        <circle cx="25" cy="26" r="4" />
        <circle cx="42" cy="25" r="5.5" />
      </g>
      <rect x="38" y="7" width="8" height="6" rx="1" fill="rgba(255,255,255,.55)" />
    </svg>
  ) : (
    <svg viewBox="0 0 56 32" className="wagon-icon" aria-hidden>
      <rect x="5" y="5" width="46" height="18" rx="3" fill={color} />
      <rect x="9" y="9" width="10" height="7" rx="1" fill="rgba(255,255,255,.45)" />
      <rect x="23" y="9" width="10" height="7" rx="1" fill="rgba(255,255,255,.45)" />
      <rect x="37" y="9" width="10" height="7" rx="1" fill="rgba(255,255,255,.45)" />
      <rect x="2" y="22" width="52" height="3" rx="1.5" fill={color} />
      <g fill={color} stroke="rgba(0,0,0,.35)" strokeWidth="1.5">
        <circle cx="14" cy="27" r="4" />
        <circle cx="42" cy="27" r="4" />
      </g>
    </svg>
  );
}

interface Props {
  color: CardColor;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  dimmed?: boolean;
  onClick?: () => void;
  highlight?: boolean;
  label?: string;
}

export function TrainCard({ color, count, size = 'md', dimmed, onClick, highlight, label }: Props) {
  const Tag = onClick ? motion.button : motion.div;
  const colorBlind = usePref('colorBlind');
  return (
    <Tag
      className={`train-card train-card--${size} ${color === 'loco' ? 'train-card--loco' : ''} ${dimmed ? 'is-dimmed' : ''} ${highlight ? 'is-highlight' : ''}`}
      style={{ ['--card' as string]: CARD_FILL[color], ['--ink' as string]: CARD_INK[color] }}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.92 } : undefined}
      aria-label={label ?? `Carte ${CARD_ADJ[color]}${count !== undefined ? ` ×${count}` : ''}`}
      type={onClick ? 'button' : undefined}
    >
      {colorBlind && (
        <span className="train-card__symbol" aria-hidden>
          {COLOR_SYMBOL[color]}
        </span>
      )}
      <span className="train-card__inner">
        <WagonIcon loco={color === 'loco'} color={color === 'loco' ? '#fff' : CARD_INK[color]} />
      </span>
      {count !== undefined && (
        <motion.span key={count} className="train-card__count" initial={{ scale: 1.8 }} animate={{ scale: 1 }}>
          {count}
        </motion.span>
      )}
    </Tag>
  );
}
