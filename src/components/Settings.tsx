import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { music } from '../lib/music';
import { setPref, usePref, type BotSpeed } from '../lib/prefs';
import { Sheet } from './Tickets';

const SPEEDS: [BotSpeed, string][] = [
  ['slow', 'Lente'],
  ['normal', 'Normale'],
  ['fast', 'Rapide'],
  ['instant', 'Éclair'],
];

function Switch({ on, onChange, label, music: isMusic }: { on: boolean; onChange: (v: boolean) => void; label: string; music?: boolean }) {
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

  return (
    <Sheet title="Réglages" subtitle="Enregistrés sur cet appareil." onClose={onClose}>
      <div className="settings">
        <Row icon="🎵" title="Musique d'ambiance">
          <Switch
            on={musicOn}
            label="Musique d'ambiance"
            music
            onChange={(v) => {
              if (v) void music.start();
              else music.stop();
              setMusicOn(v);
            }}
          />
        </Row>
        <Row icon="🎞️" title="Animation de pose" hint="Une locomotive pose les wagons de chaque route prise.">
          <Switch on={claimAnim} label="Animation de pose des wagons" onChange={(v) => setPref('claimAnim', v)} />
        </Row>
        <Row icon="✨" title="Routes jouables en évidence" hint="Pendant votre tour, les routes que vous pouvez payer scintillent.">
          <Switch on={showClaimable} label="Routes jouables en évidence" onChange={(v) => setPref('showClaimable', v)} />
        </Row>
        <Row icon="👁️" title="Mode daltonien" hint="Un symbole sur chaque couleur de carte et de route (♥ ◆ ★ ♣ ● ▲ ■ ○).">
          <Switch on={colorBlind} label="Mode daltonien" onChange={(v) => setPref('colorBlind', v)} />
        </Row>
        <Row icon="🔊" title="Voix off de la présentation">
          <Switch on={introVoice} label="Voix off de la présentation" onChange={(v) => setPref('introVoice', v)} />
        </Row>
        <div className="settings__row settings__row--block">
          <span className="settings__icon" aria-hidden>
            🤖
          </span>
          <span className="settings__text">
            <b>Vitesse des ordinateurs</b>
            <small>Temps de pause entre leurs actions.</small>
          </span>
          <div className="segmented segmented--sm settings__speeds" role="group" aria-label="Vitesse des ordinateurs">
            {SPEEDS.map(([value, label]) => (
              <button key={value} type="button" className={botSpeed === value ? 'is-on' : ''} onClick={() => setPref('botSpeed', value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Bouton ⚙️ qui ouvre les réglages. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="music-toggle settings-btn" onClick={() => setOpen(true)} aria-label="Réglages" title="Réglages">
        <span aria-hidden>⚙️</span>
      </button>
      <AnimatePresence>{open && <SettingsSheet key="settings" onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
