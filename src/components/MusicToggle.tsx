import { useEffect, useState } from 'react';
import { music } from '../lib/music';

export function MusicToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(music.playing);
  useEffect(() => music.subscribe(setOn), []);
  return (
    <button
      type="button"
      data-music-toggle
      className={`music-toggle ${on ? 'is-on' : ''} ${className}`}
      onClick={() => music.toggle()}
      aria-pressed={on}
      aria-label={on ? 'Couper la musique' : 'Activer la musique'}
      title={on ? 'Couper la musique' : 'Activer la musique'}
    >
      <span aria-hidden>{on ? '🎵' : '🔇'}</span>
    </button>
  );
}
