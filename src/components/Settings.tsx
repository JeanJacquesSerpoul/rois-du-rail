import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { music } from '../lib/music';
import { setPref, usePref, type BotSpeed, type MapTheme } from '../lib/prefs';
import { playSfx } from '../lib/sfx';
import { useT } from '../lib/i18n';
import type { Lang } from '../../shared/i18n';
import { Sheet } from './Tickets';

const THEMES: MapTheme[] = ['auto', 'day', 'dusk'];
const LANGS: [Lang, string][] = [
  ['fr', 'Français'],
  ['en', 'English'],
];

const SPEEDS: BotSpeed[] = ['slow', 'normal', 'fast', 'instant'];

function Switch({
  on,
  onChange,
  label,
  music: isMusic,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  music?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      // le module musique ignore ce clic pour sa reprise automatique au premier contact
      data-music-toggle={isMusic ? '' : undefined}
      className={`switch ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch__knob" />
    </button>
  );
}

function Row({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings__row">
      <span className="settings__icon" aria-hidden>
        {icon}
      </span>
      <span className="settings__text">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </div>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [musicOn, setMusicOn] = useState(music.playing || music.wanted);
  useEffect(() => music.subscribe(setMusicOn), []);
  const claimAnim = usePref('claimAnim');
  const showClaimable = usePref('showClaimable');
  const introVoice = usePref('introVoice');
  const botSpeed = usePref('botSpeed');
  const colorBlind = usePref('colorBlind');
  const sfx = usePref('sfx');
  const mapTheme = usePref('mapTheme');
  const lang = usePref('lang');
  const { t } = useT();

  return (
    <Sheet title={t('settings.title')} subtitle={t('settings.subtitle')} onClose={onClose}>
      <div className="settings">
        <div className="settings__row settings__row--block">
          <span className="settings__icon" aria-hidden>
            🌍
          </span>
          <span className="settings__text">
            <b>{t('settings.language')}</b>
          </span>
          <fieldset className="segmented segmented--sm settings__speeds" aria-label={t('settings.language')}>
            {LANGS.map(([value, label]) => (
              <button key={value} type="button" className={lang === value ? 'is-on' : ''} onClick={() => setPref('lang', value)}>
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        <Row icon="🎵" title={t('settings.music')}>
          <Switch
            on={musicOn}
            label={t('settings.music')}
            music
            onChange={(v) => {
              if (v) void music.start();
              else music.stop();
              setMusicOn(v);
            }}
          />
        </Row>
        <Row icon="🔔" title={t('settings.sfx')} hint={t('settings.sfxHint')}>
          <Switch
            on={sfx}
            label={t('settings.sfx')}
            onChange={(v) => {
              setPref('sfx', v);
              if (v) playSfx('chime');
            }}
          />
        </Row>
        <Row icon="🎞️" title={t('settings.claimAnim')} hint={t('settings.claimAnimHint')}>
          <Switch on={claimAnim} label={t('settings.claimAnim')} onChange={(v) => setPref('claimAnim', v)} />
        </Row>
        <Row icon="✨" title={t('settings.claimable')} hint={t('settings.claimableHint')}>
          <Switch on={showClaimable} label={t('settings.claimable')} onChange={(v) => setPref('showClaimable', v)} />
        </Row>
        <Row icon="👁️" title={t('settings.colorBlind')} hint={t('settings.colorBlindHint')}>
          <Switch on={colorBlind} label={t('settings.colorBlind')} onChange={(v) => setPref('colorBlind', v)} />
        </Row>
        <Row icon="🔊" title={t('settings.voice')}>
          <Switch on={introVoice} label={t('settings.voice')} onChange={(v) => setPref('introVoice', v)} />
        </Row>
        <div className="settings__row settings__row--block">
          <span className="settings__icon" aria-hidden>
            🌅
          </span>
          <span className="settings__text">
            <b>{t('settings.theme')}</b>
            <small>{t('settings.themeHint')}</small>
          </span>
          <fieldset className="segmented segmented--sm settings__speeds" aria-label={t('settings.theme')}>
            {THEMES.map((value) => (
              <button
                key={value}
                type="button"
                className={mapTheme === value ? 'is-on' : ''}
                onClick={() => setPref('mapTheme', value)}
              >
                {t(`settings.theme.${value}`)}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="settings__row settings__row--block">
          <span className="settings__icon" aria-hidden>
            🤖
          </span>
          <span className="settings__text">
            <b>{t('settings.speed')}</b>
            <small>{t('settings.speedHint')}</small>
          </span>
          <fieldset className="segmented segmented--sm settings__speeds" aria-label={t('settings.speed')}>
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                className={botSpeed === value ? 'is-on' : ''}
                onClick={() => setPref('botSpeed', value)}
              >
                {t(`settings.speed.${value}`)}
              </button>
            ))}
          </fieldset>
        </div>
      </div>
    </Sheet>
  );
}

/** Bouton ⚙️ qui ouvre les réglages. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  return (
    <>
      <button
        type="button"
        className="music-toggle settings-btn"
        onClick={() => setOpen(true)}
        aria-label={t('settings.title')}
        title={t('settings.title')}
      >
        <span aria-hidden>⚙️</span>
      </button>
      {/* hors de la barre du haut, pour passer au-dessus du panneau de jeu */}
      {createPortal(
        <AnimatePresence>{open && <SettingsSheet key="settings" onClose={() => setOpen(false)} />}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}
