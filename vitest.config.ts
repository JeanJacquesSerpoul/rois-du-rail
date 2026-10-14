import { defineConfig } from 'vitest/config';

// Tests unitaires du moteur ; les tests de bout en bout (e2e/) passent par Playwright.
export default defineConfig({
  test: { include: ['shared/**/*.test.ts'] },
});
