import { AnimatePresence, motion } from 'motion/react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { advise, ticketStatuses, type Advice } from '../../shared/advisor';
import { planPath } from '../../shared/bot';
import { CARD_ADJ, claimStatus, computePayment, paymentOptions, routeBlockedByPair, ticketDone } from '../../shared/engine';
import { TICKET_BY_ID } from '../../shared/map';
import { ROUTES, ROUTE_BY_ID } from '../../shared/map';
import type { Action, CardColor, GameEvent, GameState } from '../../shared/types';
import { api } from '../lib/api';
import { BOT_DELAYS, usePref } from '../lib/prefs';
import { PLAYER_FILL } from '../lib/theme';
import { AdvisorSheet } from './Advisor';
import { Board, travelTime, type PlanOverlay } from './Board';
import { EndScreen } from './EndScreen';
import { SettingsButton } from './Settings';
import { Coach } from './Tutorial';
import { ClaimSheet, EventLog, HandView, Market, PlayersBar, TicketsSheet, Toasts } from './Panels';
import { Sheet, TicketPicker } from './Tickets';


// séquence de fin chargée à la demande : elle ne sert qu'une fois par partie
const EndCinematic = lazy(() => import('./EndCinematic').then((m) => ({ default: m.EndCinematic })));

export function Game({ id, onExit, onNewGame }: { id: number; onExit: () => void; onNewGame: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [showTickets, setShowTickets] = useState(false);
  const [showLog, setShowLog] = useState(false);
  // calque des trajets de destinations, et couleur de la main touchée pour voir ce qu'elle paie
  const [showPlans, setShowPlans] = useState(false);
  const [handFocus, setHandFocus] = useState<CardColor | null>(null);
  const [adviceOpened, setAdviceOpened] = useState(false);
  const showClaimable = usePref('showClaimable');
  const botSpeed = usePref('botSpeed');
  // « Accélérer » : les ordinateurs jouent sans pause jusqu'au prochain tour humain
  const [rush, setRush] = useState(false);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [lastHuman, setLastHuman] = useState<number | null>(null);
  const [toasts, setToasts] = useState<GameEvent[]>([]);
  const [flashRoute, setFlashRoute] = useState<number | null>(null);
  const claimAnim = usePref('claimAnim');
  const [showEnd, setShowEnd] = useState(true);
  // séquence spectaculaire quand la partie se termine sous nos yeux
  const [cinematic, setCinematic] = useState(false);
  const prevPhase = useRef<GameState['phase'] | null>(null);
  // chef de gare : conseil affiché dans sa fenêtre, puis gardé en surbrillance jusqu'au prochain coup
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [hint, setHint] = useState<Advice | null>(null);
  const lastSeq = useRef(0);

  const receive = useCallback((next: GameState, initial = false) => {
    const fresh = initial ? [] : next.events.filter((e) => e.seq > lastSeq.current);
    lastSeq.current = next.eventSeq;
    if (!initial && prevPhase.current !== 'finished' && next.phase === 'finished') setCinematic(true);
    prevPhase.current = next.phase;
    setState(next);
    setHint(null);
    setAdvice(null);
    const claimed = fresh.filter((e) => e.kind === 'claimRoute').pop();
    if (claimed?.routeId !== undefined) {
      setFlashRoute(claimed.routeId);
      const duration = Math.max(1800, (travelTime(ROUTE_BY_ID[claimed.routeId].length) + 1.8) * 1000);
      setTimeout(() => setFlashRoute((r) => (r === claimed.routeId ? null : r)), duration);
    }
    const shown = fresh.filter(
      (e) => next.players[e.seat].isBot || e.kind === 'lastRound' || e.kind === 'end' || e.kind === 'claimRoute',
    );
    if (shown.length) {
      setToasts((t) => [...t, ...shown].slice(-3));
      for (const e of shown) setTimeout(() => setToasts((t) => t.filter((x) => x.seq !== e.seq)), 3200);
    }
  }, []);

  useEffect(() => {
    api
      .getGame(id)
      .then((r) => receive(r.state, true))
      .catch((e) => setError(e.message));
  }, [id, receive]);

  // L'ordinateur joue tout seul, une action à la fois pour qu'on puisse suivre.
  useEffect(() => {
    if (!state || state.phase === 'finished' || !state.players[state.current].isBot) return;
    const base = rush ? 0 : BOT_DELAYS[botSpeed];
    const delay = state.turn?.kind === 'draw' ? base * 0.6 : base;
    const t = setTimeout(() => {
      api
        .bot(id)
        .then((r) => receive(r.state))
        .catch((e) => setError(e.message));
    }, delay);
    return () => clearTimeout(t);
  }, [state, id, receive, rush, botSpeed]);

  const humans = useMemo(() => (state ? state.players.flatMap((p, i) => (p.isBot ? [] : [i])) : []), [state]);
  const currentIsHuman = state ? !state.players[state.current].isBot : false;

  useEffect(() => {
    if (state && currentIsHuman) {
      setLastHuman(state.current);
      setRush(false);
    }
  }, [state, currentIsHuman]);

  // Joueur dont on montre la main (jeu en local : celui qui a l'appareil)
  const viewer: number | null = !state
    ? null
    : currentIsHuman
      ? state.current
      : (lastHuman ?? humans[0] ?? state.current);
  const mustPassDevice =
    !!state && state.phase !== 'finished' && humans.length > 1 && currentIsHuman && revealed !== state.current;
  const myTurn = !!state && currentIsHuman && viewer === state.current && !mustPassDevice && state.phase !== 'finished';

  const act = async (action: Action) => {
    if (!state || viewer === null) return;
    setBusy(true);
    try {
      const r = await api.act(id, viewer, action);
      receive(r.state);
      navigator.vibrate?.(12);
      if (action.type === 'claimRoute') setSelectedRoute(null);
      if (action.type === 'keepTickets') setPreview([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  const handVisible = !!state && viewer !== null && !(humans.length > 1 && !myTurn && state.phase !== 'finished');

  const claimable = useMemo(() => {
    if (!state || viewer === null) return new Set<number>();
    // aperçu : routes payables avec la couleur touchée dans la main (même hors de son tour)
    if (handFocus && handVisible) {
      const me = state.players[viewer];
      return new Set(
        ROUTES.filter(
          (r) =>
            state.owners[r.id] === undefined &&
            !routeBlockedByPair(state, r, viewer) &&
            me.wagons >= r.length &&
            (handFocus === 'loco' ? paymentOptions(me.hand, r).some((p) => p.locos > 0) : computePayment(me.hand, r, handFocus) !== null),
        ).map((r) => r.id),
      );
    }
    if (!myTurn || !showClaimable || state.turn !== null) return new Set<number>();
    return new Set(ROUTES.filter((r) => claimStatus(state, viewer, r.id) === 'ok').map((r) => r.id));
  }, [state, myTurn, showClaimable, viewer, handFocus, handVisible]);

  const plans = useMemo<PlanOverlay[]>(() => {
    if (!state || !showPlans || viewer === null || !handVisible) return [];
    return ticketStatuses(state, viewer).map((t) => {
      const ticket = TICKET_BY_ID[t.id];
      const routeIds = t.state === 'open' ? (planPath(state, viewer, ticket.a, ticket.b)?.routes.map((r) => r.id) ?? []) : [];
      return { id: t.id, a: ticket.a, b: ticket.b, state: t.state, routeIds };
    });
  }, [state, showPlans, viewer, handVisible]);

  // la couleur touchée n'a plus de sens si elle a quitté la main
  useEffect(() => {
    if (handFocus && state && viewer !== null && state.players[viewer].hand[handFocus] === 0) setHandFocus(null);
  }, [state, viewer, handFocus]);

  const handHighlight = useMemo(() => {
    if (!state || selectedRoute === null || viewer === null) return new Set<CardColor>();
    const opts = paymentOptions(state.players[viewer].hand, ROUTE_BY_ID[selectedRoute]);
    return new Set<CardColor>(opts.flatMap((o) => (o.locos ? [o.color, 'loco' as CardColor] : [o.color])));
  }, [state, selectedRoute, viewer]);

  if (!state) {
    return (
      <div className="loading">
        <div className="loading__train">🚂</div>
        {error ?? 'Chargement de la partie…'}
        {error && (
          <button type="button" className="btn" onClick={onExit}>
            Retour
          </button>
        )}
      </div>
    );
  }

  const current = state.players[state.current];
  const ticketChoice = myTurn && state.turn?.kind === 'tickets' ? state.turn : null;
  const viewerTickets = viewer !== null ? state.players[viewer].tickets : [];
  const doneCount = viewer !== null ? viewerTickets.filter((t) => ticketDone(state, viewer, t)).length : 0;

  let status: string;
  if (state.phase === 'finished') status = 'Partie terminée';
  else if (!currentIsHuman) status = `${current.name} réfléchit…`;
  else if (state.phase === 'setup') status = `${current.name} : choisissez vos destinations`;
  else if (state.turn?.kind === 'draw') status = 'Prenez une seconde carte';
  else if (state.turn?.kind === 'tickets') status = 'Choisissez vos destinations';
  else status = 'À vous : piochez, posez une route ou prenez des destinations';

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="icon-btn icon-btn--light" onClick={onExit} aria-label="Retour à l'accueil">
          ←
        </button>
        <PlayersBar state={state} viewer={viewer} />
        <SettingsButton />
      </header>

      <main className="game__board">
        <Board
          state={state}
          selectedRoute={selectedRoute}
          highlightCities={hint ? [...preview, ...hint.cities] : preview}
          hintRoute={hint?.routeId ?? null}
          claimAnim={claimAnim}
          focusRoute={selectedRoute ?? hint?.routeId ?? null}
          plans={plans}
          claimable={claimable}
          flashRoute={flashRoute}
          onRouteClick={(rid) => setSelectedRoute(rid)}
        />
        <motion.div
          className={`status ${state.lastRound ? 'status--last' : ''}`}
          key={status}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ ['--pc' as string]: PLAYER_FILL[current.color] }}
        >
          <span className="status__dot" />
          {status}
          {state.lastRound && state.phase !== 'finished' && <span className="status__badge">Dernier tour</span>}
        </motion.div>
        <div className="board-tools">
          {state.phase === 'finished' && !showEnd && (
            <button type="button" className="chip-btn is-on" onClick={() => setShowEnd(true)}>
              🏆 Résultats
            </button>
          )}
          {!currentIsHuman && state.phase !== 'finished' && !rush && (
            <button type="button" className="chip-btn" onClick={() => setRush(true)} title="Les ordinateurs jouent sans pause jusqu'à votre tour">
              ⏩ Accélérer
            </button>
          )}
          {myTurn && state.phase === 'playing' && state.turn?.kind !== 'tickets' && viewer !== null && (
            <button
              type="button"
              className="chip-btn chip-btn--advisor"
              onClick={() => {
                const a = advise(state, viewer);
                setAdvice(a);
                setHint(a);
                setAdviceOpened(true);
              }}
              title="Demander conseil au chef de gare"
            >
              🧑‍✈️ Chef de gare
            </button>
          )}
          {handVisible && viewerTickets.length > 0 && state.phase !== 'finished' && (
            <button
              type="button"
              className={`chip-btn ${showPlans ? 'is-on' : ''}`}
              onClick={() => setShowPlans((v) => !v)}
              aria-pressed={showPlans}
              title="Afficher le trajet restant de chaque destination"
            >
              🎫 Trajets
            </button>
          )}
          {handFocus && (
            <button type="button" className="chip-btn is-on" onClick={() => setHandFocus(null)}>
              ✕ Aperçu {CARD_ADJ[handFocus]}
            </button>
          )}
          {hint && !advice && (
            <button type="button" className="chip-btn is-on" onClick={() => setHint(null)}>
              ✕ Conseil
            </button>
          )}
          {preview.length > 0 && (
            <button type="button" className="chip-btn is-on" onClick={() => setPreview([])}>
              ✕ Destinations
            </button>
          )}
        </div>
        {viewer !== null && !mustPassDevice && (
          <Coach gameId={id} state={state} viewer={viewer} myTurn={myTurn} plansShown={showPlans} adviceOpened={adviceOpened} />
        )}
        <Toasts toasts={toasts} state={state} />
        <AnimatePresence>
          {error && (
            <motion.div className="error-toast" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <aside className="panel">
        <Market
          state={state}
          canAct={myTurn && state.phase === 'playing' && state.turn?.kind !== 'tickets' && !busy}
          onFaceUp={(i) => act({ type: 'drawFaceUp', index: i })}
          onDeck={() => act({ type: 'drawDeck' })}
          onTickets={() => act({ type: 'drawTickets' })}
          hint={hint}
        />
        {viewer !== null && (
          <div className="panel__hand">
            {humans.length > 1 && !myTurn && state.phase !== 'finished' ? (
              <div className="hand hand--hidden">Main cachée jusqu'au tour du prochain joueur</div>
            ) : (
              <HandView state={state} seat={viewer} highlight={handHighlight} focus={handFocus} onFocus={setHandFocus} />
            )}
            <motion.button
              type="button"
              className="tickets-btn"
              onClick={() => setShowTickets(true)}
              whileTap={{ scale: 0.94 }}
              disabled={viewerTickets.length === 0 || (humans.length > 1 && !myTurn && state.phase !== 'finished')}
            >
              <span className="tickets-btn__icon">🎫</span>
              <span>
                {doneCount}/{viewerTickets.length}
              </span>
            </motion.button>
            <motion.button
              type="button"
              className="tickets-btn log-btn"
              onClick={() => setShowLog(true)}
              whileTap={{ scale: 0.94 }}
              aria-label="Journal de la partie"
            >
              <span className="tickets-btn__icon">📜</span>
              <span>Journal</span>
            </motion.button>
          </div>
        )}
        <div className="panel__log">
          <h3>Journal</h3>
          <EventLog state={state} />
        </div>
      </aside>

      <AnimatePresence>
        {ticketChoice && (
          <TicketPicker
            key={ticketChoice.offered.join('-')}
            offered={ticketChoice.offered}
            min={ticketChoice.min}
            busy={busy}
            onPreview={setPreview}
            onAdvice={() => {
              const a = advise(state, viewer!);
              return { keep: a.action.type === 'keepTickets' ? a.action.keep : ticketChoice.offered, reasons: a.reasons };
            }}
            onConfirm={(keep) => act({ type: 'keepTickets', keep })}
          />
        )}
        {selectedRoute !== null && !ticketChoice && (
          <ClaimSheet
            key="claim"
            state={state}
            routeId={selectedRoute}
            seat={myTurn ? viewer : null}
            busy={busy}
            onClaim={(color) => act({ type: 'claimRoute', routeId: selectedRoute, color })}
            onClose={() => setSelectedRoute(null)}
          />
        )}
        {advice && (
          <AdvisorSheet
            key="advisor"
            advice={advice}
            busy={busy}
            onFollow={() => act(advice.action)}
            onClose={() => setAdvice(null)}
          />
        )}
        {showLog && (
          <Sheet key="log" title="Journal de la partie" onClose={() => setShowLog(false)}>
            <EventLog state={state} />
          </Sheet>
        )}
        {showTickets && viewer !== null && (
          <TicketsSheet key="tickets" state={state} seat={viewer} onClose={() => setShowTickets(false)} onShow={setPreview} />
        )}
        {mustPassDevice && (
          <motion.button
            key="pass-device"
            type="button"
            className="pass-device"
            style={{ ['--pc' as string]: PLAYER_FILL[current.color] }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setRevealed(state.current);
              setPreview([]);
              setSelectedRoute(null);
            }}
          >
            <span className="pass-device__train">🚂</span>
            <span className="pass-device__title">Au tour de {current.name}</span>
            <span className="pass-device__hint">Passez l'appareil, puis touchez l'écran pour révéler votre main.</span>
          </motion.button>
        )}
        {state.phase === 'finished' && cinematic && (
          <Suspense key="cinematic" fallback={null}>
            <EndCinematic
              state={state}
              onDone={() => {
                setCinematic(false);
                setShowEnd(true);
              }}
            />
          </Suspense>
        )}
        {state.phase === 'finished' && showEnd && !cinematic && (
          <EndScreen
            key="end"
            state={state}
            onClose={() => setShowEnd(false)}
            onHome={onExit}
            onNewGame={onNewGame}
            onReplay={() => setCinematic(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
