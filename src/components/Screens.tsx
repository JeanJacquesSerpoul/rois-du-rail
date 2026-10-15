import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { BOT_LEVELS } from '../../shared/bot';
import { LONGEST_BONUS, ROUTE_POINTS } from '../../shared/engine';
import { MAP_IDS, MAPS, type MapId, getMap } from '../../shared/maps';
import type { BotLevel, PlayerColor, PlayerConfig } from '../../shared/types';
import { OFFLINE, api, type GameSummary, type LeaderRow } from '../lib/api';
import { errorText, useT } from '../lib/i18n';
import { setPref, usePref } from '../lib/prefs';
import { PLAYER_FILL } from '../lib/theme';
import { BrandTitle } from './Brand';
import { ConfirmDialog } from './ConfirmDialog';
import { SettingsButton } from './Settings';
import { Sheet } from './Tickets';
import { TrainCard, WagonIcon } from './TrainCard';

const ALL_COLORS: PlayerColor[] = ['crimson', 'navy', 'forest', 'amber', 'violet'];
const BOT_NAMES = ['Gustave', 'Simone', 'Marcel', 'Colette'];
const LEVEL_ICONS: Record<BotLevel, string> = { easy: '🌱', normal: '🚂', hard: '🔥' };

function storage(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Bascule rapide français / anglais. */
function LangSwitch() {
  const lang = usePref('lang');
  const { t } = useT();
  return (
    <button
      type="button"
      className="music-toggle lang-toggle"
      onClick={() => setPref('lang', lang === 'fr' ? 'en' : 'fr')}
      aria-label={t('settings.language')}
      title={t('settings.language')}
    >
      {lang === 'fr' ? 'EN' : 'FR'}
    </button>
  );
}

function HeroTrain() {
  return (
    <div className="hero-train" aria-hidden>
      <div className="hero-train__rail" />
      <motion.div
        className="hero-train__convoy"
        initial={{ x: '-110%' }}
        animate={{ x: '110vw' }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
      >
        <span className="hero-train__car hero-train__car--loco">
          <WagonIcon loco color="#1b2a41" />
        </span>
        {['#a8122a', '#dd8f0b', '#16704a', '#1c3f8f'].map((c) => (
          <span key={c} className="hero-train__car">
            <WagonIcon color={c} />
          </span>
        ))}
        <span className="hero-train__smoke" />
      </motion.div>
    </div>
  );
}

export function Home({
  onNew,
  onOpen,
  onIntro,
  onTutorial,
}: {
  onNew: () => void;
  onOpen: (id: number) => void;
  onIntro: () => void;
  onTutorial: () => Promise<void>;
}) {
  const { t } = useT();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null);
  const [sheet, setSheet] = useState<'rules' | 'stats' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<GameSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () =>
    api
      .listGames()
      .then(setGames)
      .catch((e) => setError(errorText(e, t)));
  // biome-ignore lint/correctness/useExhaustiveDependencies: chargement unique à l'ouverture de l'accueil
  useEffect(() => {
    refresh();
  }, []);

  const ongoing = games?.filter((g) => g.status !== 'finished') ?? [];
  const finished = games?.filter((g) => g.status === 'finished').slice(0, 5) ?? [];

  return (
    <div className="home">
      <div className="home__sky" />
      <div className="home__toggles">
        <LangSwitch />
        <SettingsButton />
      </div>
      <header className="home__hero">
        <motion.p className="home__kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {t('home.kicker')}
        </motion.p>
        <motion.h1
          className="home__title"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <BrandTitle />
        </motion.h1>
        <motion.p className="home__tagline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {t('home.tagline')}
        </motion.p>
        <HeroTrain />
      </header>

      <main className="home__main">
        {ongoing[0] && (
          <motion.button
            type="button"
            className="btn btn--primary btn--xl"
            onClick={() => onOpen(ongoing[0].id)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {t('home.resume', { id: ongoing[0].id })}
          </motion.button>
        )}
        <motion.button
          type="button"
          className={`btn btn--xl ${ongoing[0] ? '' : 'btn--primary'}`}
          onClick={onNew}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {t('home.newGame')}
        </motion.button>
        <div className="home__row">
          <button type="button" className="btn btn--ghost" onClick={onIntro}>
            {t('home.video')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onTutorial().catch((e) => setError(errorText(e, t)))}>
            {t('home.tutorial')}
          </button>
        </div>
        <div className="home__row">
          <button type="button" className="btn" onClick={() => setSheet('rules')}>
            {t('home.rules')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSheet('stats');
              api
                .stats()
                .then(setLeaders)
                .catch((e) => setError(errorText(e, t)));
            }}
          >
            {t('home.ranking')}
          </button>
        </div>

        {error && <p className="home__error">{t('home.serverError', { error })}</p>}
        {OFFLINE && <p className="home__note">{t('home.offlineNote')}</p>}

        {ongoing.length > 0 && (
          <section className="home__section">
            <h2>{t('home.ongoing')}</h2>
            <ul className="game-list">
              {ongoing.map((g) => (
                <GameRow key={g.id} game={g} onOpen={onOpen} onDelete={() => setToDelete(g)} />
              ))}
            </ul>
          </section>
        )}
        {finished.length > 0 && (
          <section className="home__section">
            <h2>{t('home.finished')}</h2>
            <ul className="game-list">
              {finished.map((g) => (
                <GameRow key={g.id} game={g} onOpen={onOpen} onDelete={() => setToDelete(g)} />
              ))}
            </ul>
          </section>
        )}
      </main>

      <AnimatePresence>
        {sheet === 'rules' && <Rules key="rules" onClose={() => setSheet(null)} />}
        {sheet === 'stats' && <Stats key="stats" rows={leaders} onClose={() => setSheet(null)} />}
        {toDelete && (
          <ConfirmDialog
            key="confirm-delete"
            icon="🗑"
            title={t('home.deleteTitle', { id: toDelete.id })}
            message={toDelete.status === 'finished' ? t('home.deleteFinished') : t('home.deleteOngoing')}
            confirmLabel={t('common.delete')}
            busy={deleting}
            onCancel={() => setToDelete(null)}
            onConfirm={() => {
              setDeleting(true);
              api
                .deleteGame(toDelete.id)
                .then(refresh)
                .catch((e) => setError(errorText(e, t)))
                .finally(() => {
                  setDeleting(false);
                  setToDelete(null);
                });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GameRow({ game, onOpen, onDelete }: { game: GameSummary; onOpen: (id: number) => void; onDelete: () => void }) {
  const { t, lang } = useT();
  const date = new Date(`${game.updated_at.replace(' ', 'T')}Z`);
  const winner = game.players.find((p) => p.rank === 1);
  const map = getMap(game.map_id);
  return (
    <li className="game-row">
      <button type="button" className="game-row__main" onClick={() => onOpen(game.id)}>
        <span className="game-row__players">
          {game.players.map((p) => (
            <span
              key={p.seat}
              className="game-row__dot"
              style={{ background: PLAYER_FILL[p.color as PlayerColor] }}
              title={p.name}
            >
              {p.is_bot ? '🤖' : p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
        <span className="game-row__text">
          <b>
            {t('home.game', { id: game.id })} · {map.name[lang]}
          </b>
          <small>
            {game.status === 'finished' && winner ? `${t('home.winner', { name: winner.name, pts: winner.score ?? 0 })} · ` : ''}
            {date.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}
          </small>
        </span>
        <span className="game-row__go">{game.status === 'finished' ? t('home.view') : t('home.resumeShort')} ›</span>
      </button>
      <button type="button" className="icon-btn" aria-label={t('home.deleteLabel')} onClick={onDelete}>
        🗑
      </button>
    </li>
  );
}

/** Aperçu d'une carte pour le choix de la partie. */
function MapPreview({ id, className = 'map-card__svg' }: { id: MapId; className?: string }) {
  const map = MAPS[id];
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width={map.width} height={map.height} fill="#b9d3d3" />
      {map.neighborPaths.map((d, i) => (
        <path key={`n${i}`} d={d} fill="#e2d6b8" />
      ))}
      {map.landPaths.map((d, i) => (
        <path key={`l${i}`} d={d} fill="#f6ebcf" stroke="#7a5c2e" strokeWidth={map.width / 250} />
      ))}
      {map.routes.map((r) => {
        const a = map.cityById[r.a];
        const b = map.cityById[r.b];
        return (
          <line
            key={r.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#a8122a"
            strokeOpacity=".55"
            strokeWidth={map.width / 300}
          />
        );
      })}
      {map.cities.map((c) => (
        <circle key={c.id} cx={c.x} cy={c.y} r={map.width / 160} fill="#1b2a41" />
      ))}
    </svg>
  );
}

/**
 * Choix de la carte : un résumé compact de la carte choisie, qui se déplie en
 * carrousel horizontal de cartes à faire défiler ; le choix replie le carrousel.
 */
function MapPicker({ value, onChange }: { value: MapId; onChange: (id: MapId) => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const map = MAPS[value];

  // à l'ouverture, la carte choisie est centrée dans le carrousel
  useEffect(() => {
    if (!open) return;
    const el = track.current?.querySelector<HTMLElement>('.map-card.is-on');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [open]);

  const scrollBy = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * 230, behavior: 'smooth' });

  return (
    <section className={`map-picker ${open ? 'is-open' : ''}`}>
      <button type="button" className="map-picker__summary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="map-picker__thumb">
          <MapPreview id={value} className="map-picker__svg" />
          <span className="map-picker__emoji" aria-hidden>
            {map.emoji}
          </span>
        </span>
        <span className="map-picker__info">
          <span className="map-picker__label">{t('setup.mapLabel', { n: MAP_IDS.length })}</span>
          <b className="map-picker__name">{map.name[lang]}</b>
          <small>{t('setup.mapMeta', { n: map.wagons, routes: map.routes.length })}</small>
        </span>
        <span className="map-picker__change">
          {open ? t('setup.mapClose') : t('setup.mapChange')}
          <span className="map-picker__chevron" aria-hidden>
            ▾
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="drawer"
            className="map-picker__drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <div className="map-picker__track" ref={track} role="listbox" aria-label={t('setup.map')}>
              {MAP_IDS.map((id, i) => {
                const m = MAPS[id];
                const selected = id === value;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`map-card ${selected ? 'is-on' : ''}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onChange(id);
                      // petit temps pour voir la sélection avant de replier
                      setTimeout(() => setOpen(false), 280);
                    }}
                  >
                    <span className="map-card__art">
                      <MapPreview id={id} className="map-card__svg" />
                      <span className="map-card__tag">
                        {m.emoji} {m.tag[lang]}
                      </span>
                      {selected && (
                        <span className="map-card__check" aria-hidden>
                          ✓
                        </span>
                      )}
                    </span>
                    <span className="map-card__name">{m.name[lang]}</span>
                    <span className="map-card__desc">{m.description[lang]}</span>
                    <span className="map-card__meta">
                      <span>🏙️ {m.cities.length}</span>
                      <span>🛤️ {m.routes.length}</span>
                      <span>🚃 {m.wagons}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <div className="map-picker__nav">
              <button type="button" className="map-picker__arrow" onClick={() => scrollBy(-1)} aria-label={t('setup.mapPrev')}>
                ‹
              </button>
              <span className="map-picker__hint">{t('setup.mapHint')}</span>
              <button type="button" className="map-picker__arrow" onClick={() => scrollBy(1)} aria-label={t('setup.mapNext')}>
                ›
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Setup({
  onStart,
  onBack,
}: {
  onStart: (players: PlayerConfig[], mapId: MapId) => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useT();
  // le dernier niveau choisi sert de niveau par défaut pour les nouveaux ordinateurs
  const [defaultLevel] = useState<BotLevel>(() => {
    const saved = storage('rdr.level', 'normal') as BotLevel;
    return BOT_LEVELS.includes(saved) ? saved : 'normal';
  });
  const [mapId, setMapId] = useState<MapId>(() => {
    const saved = storage('rdr.map', 'france') as MapId;
    return MAP_IDS.includes(saved) ? saved : 'france';
  });
  const [players, setPlayers] = useState<PlayerConfig[]>(() => [
    { name: storage('rdr.name', t('setup.defaultName', { n: 1 })), isBot: false, color: 'crimson', level: defaultLevel },
    { name: BOT_NAMES[0], isBot: true, color: 'navy', level: defaultLevel },
    { name: BOT_NAMES[1], isBot: true, color: 'forest', level: defaultLevel },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCount = (n: number) => {
    setPlayers((ps) => {
      if (n < ps.length) return ps.slice(0, n);
      const next = [...ps];
      while (next.length < n) {
        const color = ALL_COLORS.find((c) => !next.some((p) => p.color === c))!;
        next.push({
          name: BOT_NAMES[next.length - 1] ?? t('setup.defaultName', { n: next.length + 1 }),
          isBot: true,
          color,
          level: defaultLevel,
        });
      }
      return next;
    });
  };
  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setPlayers((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const cycleColor = (i: number) => {
    const used = new Set(players.filter((_, k) => k !== i).map((p) => p.color));
    const start = ALL_COLORS.indexOf(players[i].color);
    for (let d = 1; d <= ALL_COLORS.length; d++) {
      const c = ALL_COLORS[(start + d) % ALL_COLORS.length];
      if (!used.has(c)) return update(i, { color: c });
    }
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const firstHuman = players.find((p) => !p.isBot);
      const firstBot = players.find((p) => p.isBot);
      try {
        if (firstHuman) localStorage.setItem('rdr.name', firstHuman.name);
        if (firstBot?.level) localStorage.setItem('rdr.level', firstBot.level);
        localStorage.setItem('rdr.map', mapId);
      } catch {
        /* stockage indisponible */
      }
      await onStart(players, mapId);
    } catch (e) {
      setError(errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <div className="setup">
      <header className="setup__head">
        <button type="button" className="icon-btn icon-btn--light" onClick={onBack} aria-label={t('common.back')}>
          ←
        </button>
        <h1>{t('setup.title')}</h1>
      </header>
      <div className="setup__body">
        <MapPicker value={mapId} onChange={setMapId} />
        <div className="setup__count">
          <span>{t('setup.players')}</span>
          <div className="segmented">
            {[2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={players.length === n ? 'is-on' : ''} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <ul className="setup__players">
          <AnimatePresence initial={false}>
            {players.map((p, i) => (
              <motion.li
                key={i}
                className="setup-player"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ ['--pc' as string]: PLAYER_FILL[p.color] }}
              >
                <button
                  type="button"
                  className="setup-player__color"
                  onClick={() => cycleColor(i)}
                  aria-label={t('setup.colorLabel', { color: t(`playerColor.${p.color}`) })}
                >
                  <WagonIcon color="#fff" />
                </button>
                <input
                  className="setup-player__name"
                  value={p.name}
                  maxLength={20}
                  onChange={(e) => update(i, { name: e.target.value })}
                  aria-label={t('setup.nameLabel', { n: i + 1 })}
                />
                <div className="segmented segmented--sm">
                  <button type="button" className={!p.isBot ? 'is-on' : ''} onClick={() => update(i, { isBot: false })}>
                    {t('setup.human')}
                  </button>
                  <button type="button" className={p.isBot ? 'is-on' : ''} onClick={() => update(i, { isBot: true })}>
                    {t('setup.bot')}
                  </button>
                </div>
                {p.isBot && (
                  <fieldset className="setup-player__level" aria-label={t('setup.levelOf', { name: p.name })}>
                    <span>{t('setup.level')}</span>
                    <div className="segmented segmented--sm">
                      {BOT_LEVELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          className={(p.level ?? 'normal') === l ? 'is-on' : ''}
                          onClick={() => update(i, { level: l })}
                        >
                          {LEVEL_ICONS[l]} {t(`level.${l}`)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <p className="setup__note">
          {t('setup.hotseat')}
          {players.length < 4 && ` ${t('setup.doubles')}`}
        </p>
        {error && <p className="home__error">{error}</p>}
        <button type="button" className="btn btn--primary btn--xl" disabled={busy} onClick={start}>
          {busy ? t('setup.starting') : t('setup.start')}
        </button>
      </div>
    </div>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t('rules.title')} onClose={onClose}>
      <div className="rules">
        <p>{t('rules.intro')}</p>
        <h3>{t('rules.drawTitle')}</h3>
        <p>{t('rules.draw')}</p>
        <div className="rules__cards">
          <TrainCard color="red" size="sm" />
          <TrainCard color="blue" size="sm" />
          <TrainCard color="loco" size="sm" />
        </div>
        <h3>{t('rules.claimTitle')}</h3>
        <p>{t('rules.claim')}</p>
        <table className="rules__table">
          <tbody>
            <tr>
              <th>{t('rules.length')}</th>
              {Object.keys(ROUTE_POINTS).map((k) => (
                <td key={k}>{k}</td>
              ))}
            </tr>
            <tr>
              <th>{t('rules.points')}</th>
              {Object.values(ROUTE_POINTS).map((v) => (
                <td key={v}>{v}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <h3>{t('rules.ticketsTitle')}</h3>
        <p>{t('rules.tickets')}</p>
        <h3>{t('rules.endTitle')}</h3>
        <p>{t('rules.end', { n: LONGEST_BONUS })}</p>
      </div>
    </Sheet>
  );
}

function Stats({ rows, onClose }: { rows: LeaderRow[] | null; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t('stats.title')} subtitle={t('stats.subtitle')} onClose={onClose}>
      {!rows ? (
        <p>{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="stats__empty">{t('stats.empty')}</p>
      ) : (
        <table className="stats">
          <thead>
            <tr>
              <th>{t('stats.player')}</th>
              <th>{t('stats.games')}</th>
              <th>{t('stats.wins')}</th>
              <th>{t('stats.avg')}</th>
              <th>{t('stats.best')}</th>
              <th>{t('stats.tickets')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name}>
                <td>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : ''} {r.name} {r.is_bot ? '🤖' : ''}
                </td>
                <td>{r.games}</td>
                <td>{r.wins}</td>
                <td>{r.avg_score}</td>
                <td>{r.best_score}</td>
                <td>{r.tickets_total ? Math.round((100 * r.tickets_done) / r.tickets_total) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sheet>
  );
}
