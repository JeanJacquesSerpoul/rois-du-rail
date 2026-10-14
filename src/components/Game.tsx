import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { advise, type Advice } from '../../shared/advisor';
import { claimStatus, paymentOptions, ticketDone } from '../../shared/engine';
import { ROUTES, ROUTE_BY_ID } from '../../shared/map';
import type { Action, CardColor, GameEvent, GameState } from '../../shared/types';
import { api } from '../lib/api';
import { PLAYER_FILL } from '../lib/theme';
import { AdvisorSheet } from './Advisor';
import { AnimToggle, useClaimAnim } from './AnimToggle';
import { Board, travelTime } from './Board';
import { EndCinematic } from './EndCinematic';
import { EndScreen } from './EndScreen';
import { MusicToggle } from './MusicToggle';
import { ClaimSheet, EventLog, HandView, Market, PlayersBar, TicketsSheet, Toasts } from './Panels';
import { TicketPicker } from './Tickets';

const BOT_DELAY = 750;

export function Game({ id, onExit, onNewGame }: { id: number; onExit: () => void; onNewGame: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [showTickets, setShowTickets] = useState(false);
  const [showClaimable, setShowClaimable] = useState(true);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [lastHuman, setLastHuman] = useState<number | null>(null);
  const [toasts, setToasts] = useState<GameEvent[]>([]);
  const [flashRoute, setFlashRoute] = useState<number | null>(null);
  const claimAnim = useClaimAnim();
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
    const delay = state.turn?.kind === 'draw' ? BOT_DELAY * 0.6 : BOT_DELAY;
    const t = setTimeout(() => {
      api
        .bot(id)
        .then((r) => receive(r.state))
        .catch((e) => setError(e.message));
    }, delay);
    return () => clearTimeout(t);
  }, [state, id, receive]);

  const humans = useMemo(() => (state ? state.players.flatMap((p, i) => (p.isBot ? [] : [i])) : []), [state]);
  const currentIsHuman = state ? !state.players[state.current].isBot : false;

  useEffect(() => {
    if (state && currentIsHuman) setLastHuman(state.current);
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

  const claimable = useMemo(() => {
    if (!state || !myTurn || !showClaimable || state.turn !== null || viewer === null) return new Set<number>();
    return new Set(ROUTES.filter((r) => claimStatus(state, viewer, r.id) === 'ok').map((r) => r.id));
  }, [state, myTurn, showClaimable, viewer]);

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
        <AnimToggle />
        <MusicToggle />
      </header>

      <main className="game__board">
        <Board
          state={state}
          selectedRoute={selectedRoute}
          highlightCities={hint ? [...preview, ...hint.cities] : preview}
          hintRoute={hint?.routeId ?? null}
          claimAnim={claimAnim}
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
          <button
            type="button"
            className={`chip-btn ${showClaimable ? 'is-on' : ''}`}
            onClick={() => setShowClaimable((v) => !v)}
            title="Mettre en évidence les routes que vous pouvez prendre"
          >
            ✨ Routes jouables
          </button>
          {myTurn && state.phase === 'playing' && state.turn?.kind !== 'tickets' && viewer !== null && (
            <button
              type="button"
              className="chip-btn chip-btn--advisor"
              onClick={() => {
                const a = advise(state, viewer);
                setAdvice(a);
                setHint(a);
              }}
              title="Demander conseil au chef de gare"
            >
              🧑‍✈️ Chef de gare
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
              <HandView state={state} seat={viewer} highlight={handHighlight} />
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
        {showTickets && viewer !== null && (
          <TicketsSheet state={state} seat={viewer} onClose={() => setShowTickets(false)} onShow={setPreview} />
        )}
        {mustPassDevice && (
          <motion.button
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
          <EndCinematic
            key="cinematic"
            state={state}
            onDone={() => {
              setCinematic(false);
              setShowEnd(true);
            }}
          />
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
