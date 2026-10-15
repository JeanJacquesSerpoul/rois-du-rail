import { useState } from 'react';
import { isRoomCode } from '../../shared/online';
import { useT } from '../lib/i18n';
import { forgetIdentity, listIdentities } from '../lib/online';
import { Sheet } from './Tickets';

/**
 * Gestion des salons en ligne (depuis les réglages) : créer un salon,
 * en rejoindre un avec son code, ou revenir dans un salon déjà connu de cet appareil.
 */
export function RoomsDialog({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [known, setKnown] = useState(listIdentities);

  const go = (hash: string) => {
    onClose();
    location.hash = hash;
  };

  return (
    <Sheet title={t('rooms.title')} subtitle={t('rooms.subtitle')} onClose={onClose}>
      <div className="rooms">
        <button type="button" className="profile__back" onClick={onBack}>
          ‹ {t('settings.title')}
        </button>

        <section className="rooms__block">
          <h3>{t('rooms.createTitle')}</h3>
          <p>{t('rooms.createHint')}</p>
          <button type="button" className="btn btn--primary" onClick={() => go('#/nouveau-salon')}>
            {t('rooms.create')}
          </button>
        </section>

        <form
          className="rooms__block rooms__join"
          onSubmit={(e) => {
            e.preventDefault();
            if (isRoomCode(code)) go(`#/salon/${code}`);
          }}
        >
          <label htmlFor="rooms-code">
            <h3>{t('rooms.joinTitle')}</h3>
          </label>
          <p>{t('rooms.joinHint')}</p>
          <div className="rooms__code">
            <input
              id="rooms-code"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC234"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button type="submit" className="btn btn--primary" disabled={!isRoomCode(code)}>
              {t('rooms.join')}
            </button>
          </div>
        </form>

        {known.length > 0 && (
          <section className="rooms__block">
            <h3>{t('rooms.mine')}</h3>
            <ul className="rooms__list">
              {known.map((id) => (
                <li key={id.code}>
                  <button type="button" className="rooms__open" onClick={() => go(`#/salon/${id.code}`)}>
                    <b>{id.code}</b>
                    <small>{id.role === 'host' ? t('rooms.asHost') : t('rooms.asGuest', { n: id.seat + 1 })}</small>
                    <span aria-hidden>›</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('rooms.forget', { code: id.code })}
                    title={t('rooms.forget', { code: id.code })}
                    onClick={() => {
                      forgetIdentity(id.code);
                      setKnown(listIdentities());
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}
