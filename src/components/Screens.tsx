import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { LONGEST_BONUS, ROUTE_POINTS, WAGONS_PER_PLAYER } from '../../shared/engine';
import { BOT_LEVELS, BOT_LEVEL_NAMES } from '../../shared/bot';
import type { BotLevel, PlayerColor, PlayerConfig } from '../../shared/types';
import { OFFLINE, api, type GameSummary, type LeaderRow } from '../lib/api';
import { PLAYER_COLOR_NAMES, PLAYER_FILL } from '../lib/theme';
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

export function Home({ onNew, onOpen, onIntro }: { onNew: () => void; onOpen: (id: number) => void; onIntro: () => void }) {
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
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);

  const ongoing = games?.filter((g) => g.status !== 'finished') ?? [];
  const finished = games?.filter((g) => g.status === 'finished').slice(0, 5) ?? [];

  return (
    <div className="home">
      <div className="home__sky" />
      <div className="home__toggles">
        <SettingsButton />
      </div>
      <header className="home__hero">
        <motion.p className="home__kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          Compagnie des chemins de fer de France
        </motion.p>
        <motion.h1 className="home__title" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          Rois <span>du</span> Rail
        </motion.h1>
        <motion.p className="home__tagline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          Reliez les villes, complétez vos destinations, bâtissez le plus grand réseau du pays.
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
            ▶ Reprendre la partie n°{ongoing[0].id}
          </motion.button>
        )}
        <motion.button
          type="button"
          className={`btn btn--xl ${ongoing[0] ? '' : 'btn--primary'}`}
          onClick={onNew}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          🚂 Nouvelle partie
        </motion.button>
        <button type="button" className="btn btn--ghost" onClick={onIntro}>
          🎬 Découvrir le jeu en vidéo
        </button>
        <div className="home__row">
          <button type="button" className="btn" onClick={() => setSheet('rules')}>
            📜 Règles
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSheet('stats');
              api.stats().then(setLeaders).catch((e) => setError(e.message));
            }}
          >
            🏆 Classement
          </button>
        </div>

        {error && <p className="home__error">Serveur injoignable : {error}</p>}
        {OFFLINE && (
          <p className="home__note">
            Version de démonstration : les parties sont enregistrées dans ce navigateur. La version complète utilise un
            serveur avec base SQLite.
          </p>
        )}

        {ongoing.length > 0 && (
          <section className="home__section">
            <h2>Parties en cours</h2>
            <ul className="game-list">
              {ongoing.map((g) => (
                <GameRow key={g.id} game={g} onOpen={onOpen} onDelete={() => setToDelete(g)} />
              ))}
            </ul>
          </section>
        )}
        {finished.length > 0 && (
          <section className="home__section">
            <h2>Dernières parties</h2>
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
            title={`Supprimer la partie n°${toDelete.id} ?`}
            message={
              toDelete.status === 'finished'
                ? 'Son résultat disparaîtra aussi du classement.'
                : 'La partie en cours sera définitivement perdue.'
            }
            confirmLabel="Supprimer"
            busy={deleting}
            onCancel={() => setToDelete(null)}
            onConfirm={() => {
              setDeleting(true);
              api
                .deleteGame(toDelete.id)
                .then(refresh)
                .catch((e) => setError(e.message))
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
  const date = new Date(game.updated_at.replace(' ', 'T') + 'Z');
  const winner = game.players.find((p) => p.rank === 1);
  return (
    <li className="game-row">
      <button type="button" className="game-row__main" onClick={() => onOpen(game.id)}>
        <span className="game-row__players">
          {game.players.map((p) => (
            <span key={p.seat} className="game-row__dot" style={{ background: PLAYER_FILL[p.color as PlayerColor] }} title={p.name}>
              {p.is_bot ? '🤖' : p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
        <span className="game-row__text">
          <b>Partie n°{game.id}</b>
          <small>
            {game.status === 'finished' && winner ? `Victoire de ${winner.name} (${winner.score} pts) · ` : ''}
            {date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </small>
        </span>
        <span className="game-row__go">{game.status === 'finished' ? 'Voir' : 'Reprendre'} ›</span>
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Supprimer la partie"
        onClick={onDelete}
      >
        🗑
      </button>
    </li>
  );
}

export function Setup({ onStart, onBack }: { onStart: (players: PlayerConfig[]) => Promise<void>; onBack: () => void }) {
  // le dernier niveau choisi sert de niveau par défaut pour les nouveaux ordinateurs
  const [defaultLevel] = useState<BotLevel>(() => {
    const saved = storage('rdr.level', 'normal') as BotLevel;
    return BOT_LEVELS.includes(saved) ? saved : 'normal';
  });
  const [players, setPlayers] = useState<PlayerConfig[]>(() => [
    { name: storage('rdr.name', 'Joueur 1'), isBot: false, color: 'crimson', level: defaultLevel },
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
        next.push({ name: BOT_NAMES[next.length - 1] ?? `Joueur ${next.length + 1}`, isBot: true, color, level: defaultLevel });
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
      } catch {
        /* stockage indisponible */
      }
      await onStart(players);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="setup">
      <header className="setup__head">
        <button type="button" className="icon-btn icon-btn--light" onClick={onBack} aria-label="Retour">
          ←
        </button>
        <h1>Nouvelle partie</h1>
      </header>
      <div className="setup__body">
        <div className="setup__count">
          <span>Joueurs</span>
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
                  aria-label={`Couleur : ${PLAYER_COLOR_NAMES[p.color]} (toucher pour changer)`}
                >
                  <WagonIcon color="#fff" />
                </button>
                <input
                  className="setup-player__name"
                  value={p.name}
                  maxLength={20}
                  onChange={(e) => update(i, { name: e.target.value })}
                  aria-label={`Nom du joueur ${i + 1}`}
                />
                <div className="segmented segmented--sm">
                  <button type="button" className={!p.isBot ? 'is-on' : ''} onClick={() => update(i, { isBot: false })}>
                    👤 Humain
                  </button>
                  <button type="button" className={p.isBot ? 'is-on' : ''} onClick={() => update(i, { isBot: true })}>
                    🤖 Ordi
                  </button>
                </div>
                {p.isBot && (
                  <div className="setup-player__level" role="group" aria-label={`Niveau de ${p.name}`}>
                    <span>Niveau</span>
                    <div className="segmented segmented--sm">
                      {BOT_LEVELS.map((l) => (
                        <button key={l} type="button" className={(p.level ?? 'normal') === l ? 'is-on' : ''} onClick={() => update(i, { level: l })}>
                          {LEVEL_ICONS[l]} {BOT_LEVEL_NAMES[l]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <p className="setup__note">
          Plusieurs humains ? Jouez à tour de rôle sur le même appareil : la main de chacun reste cachée entre les tours.
          {players.length < 4 && ' À moins de 4 joueurs, une seule voie des routes doubles est utilisable.'}
        </p>
        {error && <p className="home__error">{error}</p>}
        <button type="button" className="btn btn--primary btn--xl" disabled={busy} onClick={start}>
          {busy ? 'Mise sur les rails…' : 'En voiture !'}
        </button>
      </div>
    </div>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Règles du jeu" onClose={onClose}>
      <div className="rules">
        <p>
          Chaque joueur dispose de <b>{WAGONS_PER_PLAYER} wagons</b>. À votre tour, faites <b>une seule</b> de ces trois actions :
        </p>
        <h3>1. Piocher des cartes Wagon</h3>
        <p>
          Prenez 2 cartes, visibles ou dans la pioche. Une <b>locomotive</b> visible compte pour les deux cartes ; elle ne peut pas
          être prise en seconde carte. Trois locomotives visibles ? Les 5 cartes sont remplacées.
        </p>
        <div className="rules__cards">
          <TrainCard color="red" size="sm" />
          <TrainCard color="blue" size="sm" />
          <TrainCard color="loco" size="sm" />
        </div>
        <h3>2. Prendre une route</h3>
        <p>
          Défaussez autant de cartes de la couleur de la route que sa longueur. Les routes <b>grises</b> acceptent n'importe quelle
          couleur (une seule à la fois). Les locomotives remplacent n'importe quelle couleur.
        </p>
        <table className="rules__table">
          <tbody>
            <tr>
              <th>Longueur</th>
              {Object.keys(ROUTE_POINTS).map((k) => (
                <td key={k}>{k}</td>
              ))}
            </tr>
            <tr>
              <th>Points</th>
              {Object.values(ROUTE_POINTS).map((v) => (
                <td key={v}>{v}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <h3>3. Piocher des destinations</h3>
        <p>
          Tirez 3 billets et gardez-en au moins 1. En fin de partie, un billet réalisé (villes reliées par vos routes) rapporte ses
          points, sinon il les fait perdre.
        </p>
        <h3>Fin de partie</h3>
        <p>
          Quand un joueur n'a plus que 2 wagons ou moins, chacun joue un dernier tour. Le plus long trajet continu rapporte un bonus
          de <b>{LONGEST_BONUS} points</b>.
        </p>
      </div>
    </Sheet>
  );
}

function Stats({ rows, onClose }: { rows: LeaderRow[] | null; onClose: () => void }) {
  return (
    <Sheet title="Classement" subtitle="Calculé sur toutes les parties terminées" onClose={onClose}>
      {!rows ? (
        <p>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="stats__empty">Aucune partie terminée pour l'instant. À vous de jouer !</p>
      ) : (
        <table className="stats">
          <thead>
            <tr>
              <th>Joueur</th>
              <th>Parties</th>
              <th>Victoires</th>
              <th>Moy.</th>
              <th>Record</th>
              <th>Billets</th>
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
