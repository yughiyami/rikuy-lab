import { expect, test } from '@playwright/test';

// The Raspberry Pi scanned from a real phone video ships as a demo: it opens with no cloud at all.
test('a scanned object opens in the single-phone hologram and in the projector, offline', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rikuy.gestos.interruptor', '0'));
  await page.goto('./#/holo');
  await page.getByRole('link', { name: /Escanear un objeto/ }).click();
  await expect(page.getByRole('heading', { name: 'Escanear un objeto' })).toBeVisible();
  await page.getByRole('link', { name: /Ejemplo: Raspberry Pi 4/ }).click();
  await expect(page.getByRole('heading', { name: /Raspberry Pi/ })).toBeVisible();
  await expect(page.getByTestId('motor-objeto')).toContainText('no es un modelo 3D reconstruido');
  await expect(page.getByTestId('motor-objeto')).toContainText('SAM 3.1');
  await page.getByRole('button', { name: 'Pines GPIO', exact: true }).click();
  await expect(page.getByText(/Conectan y controlan componentes/)).toBeVisible();
  await expect(page.getByText('(secundaria-1:cyt:c3)')).toBeVisible();
  await page.getByRole('link', { name: 'Proyectar en la pirámide' }).click();
  await expect(page).toHaveURL(/holo\/proyector\/[a-z0-9]{4}\?objeto=demo-raspberry/i);
  await expect(page.locator('canvas')).toBeVisible();
});
