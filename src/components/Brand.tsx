import { useT } from '../lib/i18n';

/** Titre du jeu (« Rois du Rail » / « Kings of the Rail »), le mot central en petit italique doré. */
export function BrandTitle() {
  const { t } = useT();
  return (
    <>
      {t('brand.start')} <span>{t('brand.middle')}</span> {t('brand.end')}
    </>
  );
}
