import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getMap } from '../../shared/maps';
import type { SeatInfo } from '../../shared/online';
import { errorText, useT } from '../lib/i18n';
import { type RoomClient, openRoom, roomLink } from '../lib/online';
import { PLAYER_FILL } from '../lib/theme';
import { Game } from './Game';
import { Sheet } from './Tickets';
import { WagonIcon } from './TrainCard';

/** Suit les changements d'un salon (partie, places, connexion) pour re-dessiner. */
export function useRoom(room: RoomClient) {
  return useSyncExternalStore(
    (fn) => room.subscribe(fn),
    () => `${room.state.eventSeq}|${room.link}|${room.fatal}|${room.me?.seat}|${JSON.stringify(room.seats)}`,
  );
}

/** Écran d'un salon (#/salon/CODE) : connexion, choix de sa place, puis la partie. */
export function RoomScreen({ code, onExit, onNewGame }: { code: string; onExit: () => void; onNewGame: () => void }) {
  const { t } = useT();
  const [room, setRoom] = useState<RoomClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: connexion liée au code et aux nouvelles tentatives, pas à la langue
  useEffect(() => {
    let alive = true;
    let opened: RoomClient | null = null;
    setError(null);
    openRoom(code)
      .then((r) => {
        opened = r;
        if (alive) setRoom(r);
        else r.close();
      })
      .catch((e) => alive && setError(errorText(e, t)));
    return () => {
      alive = false;
      opened?.close();
    };
  }, [code, attempt]);

  if (!room) {
    return (
      <div className="loading">
        <div className="loading__train">🚂</div>
        {error ?? t('room.connecting', { code })}
        {error && (
          <div className="loading__actions">
            <button type="button" className="btn btn--primary" onClick={() => setAttempt((n) => n + 1)}>
              {t('room.retry')}
            </button>
            <button type="button" className="btn" onClick={onExit}>
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    );
  }
  return <RoomView room={room} onExit={onExit} onNewGame={onNewGame} />;
}

function RoomView({ room, onExit, onNewGame }: { room: RoomClient; onExit: () => void; onNewGame: () => void }) {
  useRoom(room);
  if (!room.me) return <JoinRoom room={room} onExit={onExit} />;
  return <Game id={room.gameId ?? 0} room={room} onExit={onExit} onNewGame={onNewGame} />;
}

/** Un invité arrive par le lien : il choisit une place libre et donne son nom. */
function JoinRoom({ room, onExit }: { room: RoomClient; onExit: () => void }) {
  const { t, lang } = useT();
  const free = room.seats.filter((s) => s.kind === 'remote' && !s.claimed);
  const [seat, setSeat] = useState<number | null>(free[0]?.seat ?? null);
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('rdr.name') ?? '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = room.seats.find((s) => s.kind === 'host');

  // la place choisie vient d'être prise par quelqu'un d'autre
  useEffect(() => {
    if (seat !== null && !free.some((s) => s.seat === seat)) setSeat(free[0]?.seat ?? null);
  }, [free, seat]);

  const join = async () => {
    if (seat === null) return;
    setBusy(true);
    setError(null);
    try {
      try {
        if (name.trim()) localStorage.setItem('rdr.name', name.trim());
      } catch {
        /* stockage indisponible */
      }
      await room.join(seat, name.trim() || t('setup.defaultName', { n: seat + 1 }));
    } catch (e) {
      setError(errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <div className="setup join">
      <header className="setup__head">
        <button type="button" className="icon-btn icon-btn--light" onClick={onExit} aria-label={t('common.back')}>
          ←
        </button>
        <h1>{t('room.joinTitle')}</h1>
      </header>
      <div className="setup__body">
        <motion.div className="join__card" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <span className="join__code">{room.code}</span>
          <p>{t('room.joinIntro', { host: host?.name ?? '?' })}</p>
          <small>{t('room.joinMap', { map: getMap(room.state.mapId).name[lang], n: room.seats.length })}</small>
        </motion.div>

        {room.state.phase === 'finished' ? (
          <p className="setup__note">{t('room.finished')}</p>
        ) : free.length === 0 ? (
          <p className="setup__note">{t('room.full')}</p>
        ) : (
          <>
            <fieldset className="join__seats">
              <legend>{t('room.chooseSeat')}</legend>
              {room.seats.map((s) => (
                <SeatRow
                  key={s.seat}
                  room={room}
                  seat={s}
                  selectable={free.includes(s)}
                  selected={seat === s.seat}
                  onPick={setSeat}
                />
              ))}
            </fieldset>
            <label className="join__name">
              <span>{t('room.yourName')}</span>
              <input
                className="setup-player__name"
                value={name}
                maxLength={20}
                placeholder={t('setup.defaultName', { n: (seat ?? 0) + 1 })}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </>
        )}
        {error && <p className="home__error">{error}</p>}
        {free.length > 0 && room.state.phase !== 'finished' && (
          <button type="button" className="btn btn--primary btn--xl" disabled={busy || seat === null} onClick={join}>
            {busy ? t('setup.starting') : t('room.join')}
          </button>
        )}
      </div>
    </div>
  );
}

function SeatRow({
  room,
  seat,
  selectable,
  selected,
  onPick,
}: {
  room: RoomClient;
  seat: SeatInfo;
  selectable?: boolean;
  selected?: boolean;
  onPick?: (seat: number) => void;
}) {
  const { t } = useT();
  const player = room.state.players[seat.seat];
  const mine = room.me?.seat === seat.seat;
  const label =
    seat.kind === 'bot'
      ? t('room.seatBot')
      : seat.kind === 'host'
        ? t('room.seatHost')
        : !seat.claimed
          ? t('room.seatFree')
          : t('room.seatGuest');
  const content = (
    <>
      <span className="seat-row__wagon" style={{ background: PLAYER_FILL[player.color] }}>
        <WagonIcon color="#fff" />
      </span>
      <span className="seat-row__text">
        <b>
          {seat.kind === 'remote' && !seat.claimed ? t('room.freeName') : seat.name}
          {mine && ` ${t('room.you')}`}
        </b>
        <small>{label}</small>
      </span>
      <span
        role="img"
        className={`seat-row__presence ${seat.connected ? 'is-on' : ''}`}
        title={seat.connected ? t('room.connected') : t('room.away')}
        aria-label={seat.connected ? t('room.connected') : t('room.away')}
      />
    </>
  );
  if (!onPick)
    return (
      <li className={`seat-row ${mine ? 'is-mine' : ''}`} style={{ ['--pc' as string]: PLAYER_FILL[player.color] }}>
        {content}
      </li>
    );
  return (
    <button
      type="button"
      className={`seat-row ${selected ? 'is-on' : ''}`}
      style={{ ['--pc' as string]: PLAYER_FILL[player.color] }}
      disabled={!selectable}
      aria-pressed={selected}
      onClick={() => onPick(seat.seat)}
    >
      {content}
    </button>
  );
}

/** Bouton de la barre du haut : places connectées, et fenêtre du salon. */
export function RoomButton({ room }: { room: RoomClient }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useRoom(room);
  const humans = room.seats.filter((s) => s.kind !== 'bot');
  const here = humans.filter((s) => s.connected).length;
  const waiting = room.seats.some((s) => s.kind === 'remote' && !s.claimed);
  return (
    <>
      <button
        type="button"
        className={`room-btn room-btn--${room.link} ${waiting ? 'is-waiting' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={t('room.title')}
        title={t('room.title')}
      >
        <span aria-hidden>👥</span>
        <span>
          {here}/{humans.length}
        </span>
      </button>
      {/* hors de la barre du haut, pour passer au-dessus du panneau de jeu */}
      {createPortal(
        <AnimatePresence>{open && <RoomSheet key="room" room={room} onClose={() => setOpen(false)} />}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export function RoomSheet({ room, onClose }: { room: RoomClient; onClose: () => void }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  useRoom(room);
  const link = roomLink(room.code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t('room.copyManual'), link);
    }
  };
  const share = () =>
    navigator.share?.({ title: t('brand.full'), text: t('room.shareText', { code: room.code }), url: link }).catch(() => {});

  return (
    <Sheet title={t('room.title')} subtitle={t(`room.link.${room.link}`)} onClose={onClose}>
      <div className="room-sheet">
        <div className="room-sheet__code">
          <span>{t('room.code')}</span>
          <b>{room.code}</b>
        </div>
        <div className="room-sheet__link">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t('room.link')} />
          <button type="button" className="btn btn--primary" onClick={copy}>
            {copied ? t('room.copied') : t('room.copy')}
          </button>
          {typeof navigator.share === 'function' && (
            <button type="button" className="btn" onClick={share}>
              {t('room.share')}
            </button>
          )}
        </div>
        <p className="room-sheet__hint">{room.drivesBots ? t('room.hintPeer') : t('room.hint')}</p>
        <ul className="room-sheet__seats">
          {room.seats.map((s) => (
            <SeatRow key={s.seat} room={room} seat={s} />
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
