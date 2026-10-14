import { AnimatePresence, motion } from 'motion/react';
import {
  CARD_COLORS,
  COLOR_NAMES,
  LONGEST_BONUS,
  ROUTE_POINTS,
  longestPath,
  claimStatus,
  handSize,
  paymentOptions,
  routeName,
  ticketDone,
} from '../../shared/engine';
import { BOT_LEVEL_NAMES } from '../../shared/bot';
import { CITY_BY_ID, ROUTE_BY_ID, TICKET_BY_ID } from '../../shared/map';
import type { CardColor, GameEvent, GameState } from '../../shared/types';
import { usePref } from '../lib/prefs';
import { CARD_FILL, CARD_INK, COLOR_SYMBOL, PLAYER_FILL, PLAYER_LIGHT, ROUTE_FILL } from '../lib/theme';
import { Sheet, TicketCard } from './Tickets';
import { TrainCard, WagonIcon } from './TrainCard';

export function PlayersBar({ state, viewer }: { state: GameState; viewer: number | null }) {
  return (
    <div className="players">
      {state.players.map((p, i) => {
        const active = state.current === i && state.phase !== 'finished';
        return (
          <motion.div
            key={i}
            className={`player-chip ${active ? 'is-active' : ''}`}
            style={{ ['--pc' as string]: PLAYER_FILL[p.color], ['--pl' as string]: PLAYER_LIGHT[p.color] }}
            animate={active ? { y: [0, -2, 0] } : { y: 0 }}
            transition={active ? { repeat: Infinity, duration: 1.6 } : undefined}
          >
            <span className="player-chip__avatar">{p.isBot ? '🤖' : p.name.slice(0, 1).toUpperCase()}</span>
            <span className="player-chip__info">
              <span className="player-chip__name">
                {p.name}
                {viewer === i && !p.isBot && <span className="player-chip__you"> (vous)</span>}
                {p.isBot && <span className="player-chip__you"> · {BOT_LEVEL_NAMES[p.level ?? 'normal']}</span>}
              </span>
              <span className="player-chip__stats">
                <b>{p.routePoints}</b> pts · 🚃 {p.wagons} · 🃏 {handSize(p.hand)} · 🎫 {p.tickets.length}
              </span>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

interface MarketProps {
  state: GameState;
  canAct: boolean;
  onFaceUp: (i: number) => void;
  onDeck: () => void;
  onTickets: () => void;
  hint?: { marketIndex?: number; deck?: 'cards' | 'tickets' } | null;
}

export function Market({ state, canAct, onFaceUp, onDeck, onTickets, hint }: MarketProps) {
  const secondDraw = state.turn?.kind === 'draw';
  const deckCount = state.deck.length + state.discard.length;
  return (
    <div className="market">
      {secondDraw && canAct && (
        <motion.span className="market__badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>
          Carte 2/2
        </motion.span>
      )}
      <div className="market__cards">
        <AnimatePresence mode="popLayout">
          {state.market.map((c, i) =>
            c ? (
              <motion.div
                key={`${i}-${c}`}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
              >
                <TrainCard
                  color={c}
                  size="md"
                  dimmed={!canAct || (secondDraw && c === 'loco')}
                  highlight={hint?.marketIndex === i}
                  onClick={canAct && !(secondDraw && c === 'loco') ? () => onFaceUp(i) : undefined}
                />
              </motion.div>
            ) : (
              <div key={`empty-${i}`} className="train-card train-card--md train-card--empty" />
            ),
          )}
        </AnimatePresence>
      </div>
      <div className="market__decks">
        <motion.button
          type="button"
          className={`deck deck--cards ${hint?.deck === 'cards' ? 'is-hint' : ''}`}
          disabled={!canAct || deckCount === 0}
          onClick={onDeck}
          whileTap={{ scale: 0.92 }}
          aria-label="Piocher une carte cachée"
        >
          <span className="deck__stack" />
          <WagonIcon color="#f3e3b5" />
          <span className="deck__count">{deckCount}</span>
        </motion.button>
        <motion.button
          type="button"
          className={`deck deck--tickets ${hint?.deck === 'tickets' ? 'is-hint' : ''}`}
          disabled={!canAct || secondDraw || state.ticketDeck.length === 0}
          onClick={onTickets}
          whileTap={{ scale: 0.92 }}
          aria-label="Piocher des destinations"
        >
          <span className="deck__stack" />
          <span className="deck__ticket-icon">🎫</span>
          <span className="deck__count">{state.ticketDeck.length}</span>
        </motion.button>
      </div>
    </div>
  );
}

export function HandView({
  state,
  seat,
  highlight,
  focus = null,
  onFocus,
}: {
  state: GameState;
  seat: number;
  highlight: Set<CardColor>;
  /** Couleur touchée pour voir les routes qu'elle permet de payer. */
  focus?: CardColor | null;
  onFocus?: (c: CardColor | null) => void;
}) {
  const hand = state.players[seat].hand;
  const colors = CARD_COLORS.filter((c) => hand[c] > 0);
  return (
    <div className="hand">
      {colors.length === 0 && <span className="hand__empty">Aucune carte en main</span>}
      <AnimatePresence>
        {colors.map((c) => (
          <motion.div
            key={c}
            layout
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
          >
            <TrainCard
              color={c}
              count={hand[c]}
              size="sm"
              highlight={highlight.has(c) || focus === c}
              onClick={onFocus ? () => onFocus(focus === c ? null : c) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ClaimSheetProps {
  state: GameState;
  routeId: number;
  seat: number | null;
  busy: boolean;
  onClaim: (color: CardColor) => void;
  onClose: () => void;
}

const STATUS_TEXT: Record<string, string> = {
  owned: 'Route déjà prise.',
  pair: 'Voie double : la voie parallèle est déjà prise (ou partie à moins de 4 joueurs).',
  wagons: "Vous n'avez plus assez de wagons.",
  cards: 'Vous n’avez pas les cartes nécessaires.',
  notYourTurn: 'Vous ne pouvez pas prendre de route maintenant.',
};

export function ClaimSheet({ state, routeId, seat, busy, onClaim, onClose }: ClaimSheetProps) {
  const route = ROUTE_BY_ID[routeId];
  const owner = state.owners[routeId];
  const status = seat === null ? 'notYourTurn' : claimStatus(state, seat, routeId);
  const options = seat === null ? [] : paymentOptions(state.players[seat].hand, route);
  const colorBlind = usePref('colorBlind');
  return (
    <Sheet title={routeName(route)} onClose={onClose}>
      <div className="claim">
        <div className="claim__route">
          {Array.from({ length: route.length }, (_, i) => (
            <span
              key={i}
              className="claim__slot"
              style={{
                background: owner !== undefined ? PLAYER_FILL[state.players[owner].color] : ROUTE_FILL[route.color],
                color: CARD_INK[route.color],
              }}
            >
              {colorBlind && owner === undefined ? COLOR_SYMBOL[route.color] : null}
            </span>
          ))}
        </div>
        <p className="claim__meta">
          {route.length} wagon{route.length > 1 ? 's' : ''} · couleur {COLOR_NAMES[route.color]} ·{' '}
          <b>+{ROUTE_POINTS[route.length]} points</b>
          {route.pair !== undefined && ' · voie double'}
        </p>
        {owner !== undefined ? (
          <p className="claim__owner" style={{ color: PLAYER_FILL[state.players[owner].color] }}>
            Propriété de {state.players[owner].name}
          </p>
        ) : status === 'ok' ? (
          <>
            <p className="claim__hint">Choisissez comment payer :</p>
            <div className="claim__options">
              {options.map((p) => (
                <motion.button
                  key={p.color}
                  type="button"
                  className="pay-option"
                  disabled={busy}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onClaim(p.color)}
                >
                  {p.colored > 0 && (
                    <span className="pay-option__part">
                      <span className="pay-dot" style={{ background: CARD_FILL[p.color], color: CARD_INK[p.color] }}>
                        {colorBlind ? COLOR_SYMBOL[p.color] : null}
                      </span>{' '}
                      ×{p.colored}
                    </span>
                  )}
                  {p.locos > 0 && (
                    <span className="pay-option__part">
                      <span className="pay-dot pay-dot--loco" /> ×{p.locos}
                    </span>
                  )}
                  <span className="pay-option__go">Prendre</span>
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          <p className="claim__blocked">{STATUS_TEXT[status]}</p>
        )}
      </div>
    </Sheet>
  );
}

/** Score détaillé en direct, avec ce que le joueur sait (ses billets et la table). */
function ScoreSummary({ state, seat }: { state: GameState; seat: number }) {
  const me = state.players[seat];
  const doneIds = me.tickets.filter((id) => ticketDone(state, seat, id));
  const openIds = me.tickets.filter((id) => !doneIds.includes(id));
  const ticketGain = doneIds.reduce((n, id) => n + TICKET_BY_ID[id].points, 0);
  const ticketRisk = openIds.reduce((n, id) => n + TICKET_BY_ID[id].points, 0);
  const mine = longestPath(state, seat);
  const best = Math.max(0, ...state.players.map((_, i) => (i === seat ? 0 : longestPath(state, i))));
  const leads = mine > 0 && mine >= best;
  const total = me.routePoints + ticketGain - ticketRisk + (leads ? LONGEST_BONUS : 0);
  return (
    <div className="score-sum">
      <div className="score-sum__row">
        <span>🛤️ Routes posées</span>
        <b>{me.routePoints} pts</b>
      </div>
      <div className="score-sum__row score-sum__row--good">
        <span>✓ Billets réalisés ({doneIds.length})</span>
        <b>+{ticketGain}</b>
      </div>
      <div className="score-sum__row score-sum__row--risk">
        <span>⏳ Billets en cours ({openIds.length})</span>
        <b>{ticketRisk ? `−${ticketRisk}` : '0'}</b>
      </div>
      <div className="score-sum__row">
        <span>
          🏅 Plus long trajet : {mine} wagon{mine > 1 ? 's' : ''}
          <small>{leads ? ' · en tête' : ` · record adverse ${best}`}</small>
        </span>
        <b>{leads ? `+${LONGEST_BONUS}` : '0'}</b>
      </div>
      <div className="score-sum__row score-sum__row--total">
        <span>Si la partie finissait maintenant</span>
        <b>{total < 0 ? `−${-total}` : total} pts</b>
      </div>
    </div>
  );
}

export function TicketsSheet({
  state,
  seat,
  onClose,
  onShow,
}: {
  state: GameState;
  seat: number;
  onClose: () => void;
  onShow: (cities: string[]) => void;
}) {
  const tickets = state.players[seat].tickets;
  const done = tickets.filter((id) => ticketDone(state, seat, id)).length;
  return (
    <Sheet
      title="Vos destinations"
      subtitle={`${done} / ${tickets.length} réalisées · touchez un billet pour le voir sur la carte`}
      onClose={onClose}
    >
      <ScoreSummary state={state} seat={seat} />
      <div className="ticket-list">
        {tickets.map((id) => (
          <TicketCard
            key={id}
            id={id}
            done={ticketDone(state, seat, id)}
            onClick={() => {
              const t = TICKET_BY_ID[id];
              onShow([t.a, t.b]);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

export function EventLog({ state }: { state: GameState }) {
  const events = [...state.events].reverse().slice(0, 25);
  return (
    <ol className="log">
      {events.map((e) => (
        <li key={e.seq} style={{ ['--pc' as string]: PLAYER_FILL[state.players[e.seat].color] }}>
          {e.text}
        </li>
      ))}
    </ol>
  );
}

export function Toasts({ toasts, state }: { toasts: GameEvent[]; state: GameState }) {
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.seq}
            className={`toast toast--${t.kind}`}
            style={{ ['--pc' as string]: PLAYER_FILL[state.players[t.seat].color] }}
            initial={{ y: -20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            layout
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function cityName(id: string) {
  return CITY_BY_ID[id].name;
}
