import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { routeName } from '../../shared/engine';
import { MAPS } from '../../shared/maps';
import type { HistoryEntry, PlayerProfile } from '../../shared/stats';
import { api } from '../lib/api';
import { errorText, useT } from '../lib/i18n';
import { CARD_FILL, CARD_INK } from '../lib/theme';
import { Sheet } from './Tickets';

/** Fiche d'un joueur : chiffres clés, courbe des scores, cartes et cartes de jeu préférées, historique. */
export function PlayerSheet({ name, onBack }: { name: string; onBack: () => void }) {
  const { t } = useT();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chargement à l'ouverture de la fiche
  useEffect(() => {
    api
      .player(name)
      .then(setProfile)
      .catch((e) => setError(errorText(e, t)));
  }, [name]);

  return (
    <Sheet title={`${name}${profile?.isBot ? ' 🤖' : ''}`} subtitle={t('profile.subtitle')} onClose={onBack}>
      <div className="profile">
        <button type="button" className="profile__back" onClick={onBack}>
          ‹ {t('profile.back')}
        </button>
        {error ? <p className="home__error">{error}</p> : !profile ? <p>{t('common.loading')}</p> : <ProfileBody p={profile} />}
      </div>
    </Sheet>
  );
}

function ProfileBody({ p }: { p: PlayerProfile }) {
  const { t, lang } = useT();
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const kpis = [
    { label: t('profile.games'), value: p.games },
    { label: t('profile.wins'), value: `${p.wins}`, sub: `${pct(p.wins, p.games)} %` },
    { label: t('profile.avg'), value: p.avgScore },
    { label: t('profile.best'), value: p.bestScore },
    { label: t('profile.tickets'), value: `${pct(p.ticketsDone, p.ticketsTotal)} %`, sub: `${p.ticketsDone}/${p.ticketsTotal}` },
  ];
  const maxCards = Math.max(1, ...p.cards.map((c) => c.count));
  const totalCards = p.cards.reduce((n, c) => n + c.count, 0);

  return (
    <>
      <div className="profile__kpis">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            className="kpi"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.04 * i }}
          >
            <b>{k.value}</b>
            <span>{k.label}</span>
            {k.sub && <small>{k.sub}</small>}
          </motion.div>
        ))}
      </div>

      <section className="profile__section">
        <h3>{t('profile.curve')}</h3>
        <ScoreCurve history={p.history} avg={p.avgScore} />
      </section>

      <section className="profile__section">
        <h3>{t('profile.cards')}</h3>
        {p.cards.length === 0 ? (
          <p className="profile__empty">{t('profile.noCards')}</p>
        ) : (
          <ul className="bars">
            {p.cards.map((c) => (
              <li key={c.color} className="bars__row">
                <span className="bars__label">{t(`card.${c.color}`)}</span>
                <span className="bars__track">
                  <span
                    className="bars__fill"
                    style={{
                      width: `${(100 * c.count) / maxCards}%`,
                      background: CARD_FILL[c.color],
                      color: CARD_INK[c.color],
                    }}
                  />
                </span>
                <span className="bars__value">
                  {c.count} <small>({Math.round((100 * c.count) / totalCards)} %)</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="profile__split">
        <section className="profile__section">
          <h3>{t('profile.maps')}</h3>
          <ul className="profile__list">
            {p.maps.map((m) => (
              <li key={m.mapId}>
                <span>
                  {MAPS[m.mapId].emoji} {MAPS[m.mapId].name[lang]}
                </span>
                <span>
                  {t('profile.gamesCount', { n: m.games })}
                  {m.wins > 0 && ` · 🏆 ${m.wins}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {p.routes.length > 0 && (
          <section className="profile__section">
            <h3>{t('profile.routes')}</h3>
            <ul className="profile__list">
              {p.routes.map((r) => {
                const map = MAPS[r.mapId];
                return (
                  <li key={`${r.mapId}:${r.routeId}`}>
                    <span>{routeName(map, map.routeById[r.routeId], lang)}</span>
                    <span>×{r.count}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <section className="profile__section">
        <h3>{t('profile.history')}</h3>
        <ul className="profile__history">
          {[...p.history]
            .reverse()
            .slice(0, 8)
            .map((h) => (
              <li key={h.gameId} className={h.won ? 'is-win' : ''}>
                <span className="profile__rank">{h.won ? '🏆' : `${h.rank}ᵉ`}</span>
                <span>
                  {MAPS[h.mapId].emoji} {MAPS[h.mapId].name[lang]}
                  <small>
                    {formatDate(h.date, lang)} · {t('profile.rankOf', { rank: h.rank, n: h.players })}
                  </small>
                </span>
                <b>{t('profile.pts', { n: h.score })}</b>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function formatDate(date: string, lang: 'fr' | 'en') {
  const d = new Date(date.includes('T') ? date : `${date.replace(' ', 'T')}Z`);
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
}

/** Courbe des scores, de la plus ancienne partie à la plus récente ; les victoires sont dorées. */
function ScoreCurve({ history, avg }: { history: HistoryEntry[]; avg: number }) {
  const { t, lang } = useT();
  const W = 320;
  const H = 150;
  const pad = { l: 30, r: 10, t: 12, b: 20 };
  const scores = history.map((h) => h.score);
  const lo = Math.min(0, ...scores);
  const hi = Math.max(10, ...scores);
  const x = (i: number) =>
    pad.l + (history.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (history.length - 1));
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo || 1);
  const line = history.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.score).toFixed(1)}`).join(' ');
  const area = `${line} L${x(history.length - 1).toFixed(1)},${y(lo)} L${x(0).toFixed(1)},${y(lo)} Z`;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('profile.curveLabel', { n: history.length })}>
      <defs>
        <linearGradient id="curve-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--curve-line)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--curve-line)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line className="curve__grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
          <text className="curve__tick" x={pad.l - 6} y={y(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <line className="curve__avg" x1={pad.l} x2={W - pad.r} y1={y(avg)} y2={y(avg)} />
      <text className="curve__avg-label" x={W - pad.r} y={y(avg) - 4} textAnchor="end">
        {t('profile.avgShort', { n: avg })}
      </text>
      {history.length > 1 && <path d={area} fill="url(#curve-fill)" />}
      {history.length > 1 && <path className="curve__line" d={line} pathLength={1} />}
      {history.map((h, i) => (
        <circle key={h.gameId} className={`curve__dot ${h.won ? 'is-win' : ''}`} cx={x(i)} cy={y(h.score)} r={h.won ? 4.5 : 3.5}>
          <title>
            {`${formatDate(h.date, lang)} · ${MAPS[h.mapId].name[lang]} · ${t('profile.pts', { n: h.score })} · ${t('profile.rankOf', { rank: h.rank, n: h.players })}`}
          </title>
        </circle>
      ))}
      <text className="curve__tick" x={pad.l} y={H - 4}>
        {t('profile.first')}
      </text>
      <text className="curve__tick" x={W - pad.r} y={H - 4} textAnchor="end">
        {t('profile.last')}
      </text>
    </svg>
  );
}
