import { expect, type Page, test } from '@playwright/test';

/** Réglages de test : présentation déjà vue, ordinateurs instantanés, pas d'animation de pose. */
async function fastPrefs(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('rdr.introSeen', '1');
    localStorage.setItem('rdr.botSpeed', 'instant');
    localStorage.setItem('rdr.claimAnim', '0');
  });
}

/** État de la partie en cours, lu dans le stockage de la version hors ligne. */
async function savedGame(page: Page) {
  return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('rdr.games.v1') ?? '{"games":{}}');
    const id = Number(location.hash.split('/').pop());
    return store.games[id]?.state as {
      owners: Record<string, number>;
      phase: string;
      players: { hand: Record<string, number> }[];
    };
  });
}

async function newGame(page: Page, { firstIsBot = false } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nouvelle partie/ }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  if (firstIsBot) await page.locator('.setup-player').first().getByRole('button', { name: /Ordi/ }).click();
  await page.getByRole('button', { name: /En voiture/ }).click();
  await expect(page).toHaveURL(/#\/partie\/\d+/);
}

test('première visite : la présentation s’affiche une seule fois', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Présentation du jeu' });
  await expect(intro).toBeVisible();
  await page.getByRole('button', { name: /Passer/ }).click();
  await expect(intro).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: /Nouvelle partie/ })).toBeVisible();
  await expect(intro).toBeHidden();
});

test('un tour de jeu : choisir ses billets puis piocher deux cartes', async ({ page }) => {
  await fastPrefs(page);
  await newGame(page);

  await page.getByRole('button', { name: /Garder \d destination/ }).click();
  const status = page.locator('.status');
  await expect(status).toContainText('À vous');

  const before = await savedGame(page);
  const cards = (s: typeof before) => Object.values(s.players[0].hand).reduce((a, b) => a + b, 0);
  await page.getByLabel('Piocher une carte cachée').click();
  await expect(page.locator('.market__badge')).toHaveText('Carte 2/2');
  await page.getByLabel('Piocher une carte cachée').click();

  // l'ordinateur joue, puis la main revient au joueur avec deux cartes de plus
  await expect(status).toContainText('À vous', { timeout: 20_000 });
  expect(cards(await savedGame(page))).toBe(cards(before) + 2);
});

test('le chef de gare fait poser une route', async ({ page }) => {
  await fastPrefs(page);
  await newGame(page);
  const keep = page.getByRole('button', { name: /Garder \d destination/ });
  await keep.click();
  await expect(keep).toBeHidden();

  for (let turn = 0; turn < 40; turn++) {
    if (Object.values((await savedGame(page)).owners).includes(0)) break;
    // le conseil peut être de reprendre des destinations : on garde la sélection proposée
    if ((await keep.isVisible()) && (await keep.isEnabled())) {
      await keep.click();
      await expect(keep).toBeHidden();
      continue;
    }
    const advisor = page.getByRole('button', { name: /Chef de gare/ });
    await expect(advisor.or(keep).first()).toBeVisible({ timeout: 20_000 });
    if (!(await advisor.isVisible())) continue;
    await advisor.click();
    await page.getByRole('button', { name: /Suivre le conseil/ }).click();
    await expect(page.locator('.advisor')).toBeHidden();
  }
  expect(Object.values((await savedGame(page)).owners)).toContain(0);
});

test('une partie complète entre ordinateurs se termine par le final', async ({ page }) => {
  await fastPrefs(page);
  await newGame(page, { firstIsBot: true });

  await expect(page.locator('.cine__title')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.cine__winner-name')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Voir les résultats/ }).click();
  await expect(page.getByText(/remporte la partie/)).toBeVisible();
  expect((await savedGame(page)).phase).toBe('finished');
});

test('le jeu se recharge sans réseau grâce au service worker', async ({ page, context }) => {
  await fastPrefs(page);
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // laisse le service worker prendre la main sur la page, puis coupe le réseau
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /Nouvelle partie/ })).toBeVisible();
  await page.getByRole('button', { name: /Nouvelle partie/ }).click();
  await expect(page.getByRole('button', { name: /En voiture/ })).toBeVisible();
  await context.setOffline(false);
});
