import { useSyncExternalStore } from 'react';

/** Préférence « animation de pose des wagons », partagée entre l'accueil et la partie. */
const KEY = 'rdr.claimAnim';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === '1';
  } catch {
    /* stockage indisponible */
  }
  // activée par défaut, sauf si l'appareil demande moins d'animations
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

let current = read();

function set(on: boolean) {
  current = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* stockage indisponible */
  }
  for (const fn of listeners) fn();
}

export function useClaimAnim(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => current,
  );
}

export function AnimToggle() {
  const on = useClaimAnim();
  return (
    <button
      type="button"
      className={`music-toggle anim-toggle ${on ? 'is-on' : ''}`}
      onClick={() => set(!on)}
      aria-pressed={on}
      aria-label={on ? 'Désactiver l’animation de pose des wagons' : 'Activer l’animation de pose des wagons'}
      title={on ? 'Animation de pose des wagons : activée' : 'Animation de pose des wagons : désactivée'}
    >
      <span aria-hidden>🎞️</span>
    </button>
  );
}
