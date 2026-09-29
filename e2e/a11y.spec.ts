import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { shipCells } from '../src/engine/board';
import { newGame } from '../src/engine/game';
import { cellLabel } from '../src/ui/labels';

const SEED = 20260926;

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations.map((v) => `${v.id}: ${v.help}`);
}

test('the fresh board has no accessibility violations', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&delay=0`);
  await expect(page.getByRole('heading', { name: 'Battleship' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('the finished game and its overlay have no accessibility violations', async ({
  page,
}) => {
  await page.goto(`/?seed=${SEED}&delay=0`);
  for (const label of newGame(SEED).ai.ships.flatMap(shipCells).map(cellLabel)) {
    await page.getByTestId('enemy-board').locator(`[data-cell="${label}"]`).click();
  }
  await expect(page.getByTestId('game-over')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
