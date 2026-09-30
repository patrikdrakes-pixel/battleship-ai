import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { FLEET } from '../src/engine/constants';

const SEED = 20260926;

async function open(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}&delay=0`);
  await page.getByTestId('place-ships').click();
  await expect(page.getByTestId('placement-board')).toBeVisible();
}

function placementCell(page: Page, label: string) {
  return page.getByTestId('placement-board').locator(`[data-cell="${label}"]`);
}

/** One ship per row, all horizontal, starting at column A. */
async function placeFleet(page: Page): Promise<void> {
  for (let row = 0; row < FLEET.length; row += 1) {
    await placementCell(page, `A${row + 1}`).click();
  }
}

test('manual placement starts a game with the chosen layout', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('placement-current')).toContainText('Placing Carrier');

  await placeFleet(page);
  await expect(page.getByTestId('placement-current')).toContainText('Fleet complete');
  await page.getByRole('button', { name: 'Start battle' }).click();

  const own = page.getByTestId('player-board');
  await expect(own).toBeVisible();
  await expect(own.locator('[data-state="ship"]')).toHaveCount(17);
  await expect(page.getByTestId('status')).toContainText('Your turn');

  // The chosen rows are exactly the ship cells: row 1 holds the 5-cell carrier.
  for (let c = 0; c < 5; c += 1) {
    await expect(own.locator(`[aria-label^="${'ABCDEFGHIJ'[c]}1 "]`)).toHaveAttribute(
      'data-state',
      'ship',
    );
  }
});

test('placement rejects overlaps and previews legality', async ({ page }) => {
  await open(page);
  await placementCell(page, 'A1').click();
  await expect(page.getByTestId('placement-current')).toContainText('Placing Battleship');

  await placementCell(page, 'A1').hover();
  await expect(placementCell(page, 'A1')).toHaveAttribute('data-preview', 'illegal');
  await placementCell(page, 'A1').click();
  await expect(page.getByTestId('placement-current')).toContainText('Placing Battleship');

  await placementCell(page, 'A3').hover();
  await expect(placementCell(page, 'A3')).toHaveAttribute('data-preview', 'legal');
  await expect(placementCell(page, 'D3')).toHaveAttribute('data-preview', 'legal');
});

test('rotate, random, clear and cancel', async ({ page }) => {
  await open(page);
  const start = page.getByRole('button', { name: 'Start battle' });
  await expect(start).toBeDisabled();

  await page.getByRole('button', { name: 'Rotate' }).click();
  await expect(page.getByTestId('placement-current')).toContainText('vertical');

  await page.getByRole('button', { name: 'Random fleet' }).click();
  await expect(start).toBeEnabled();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(start).toBeDisabled();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('placement-board')).toHaveCount(0);
  await expect(page.getByTestId('enemy-board')).toBeVisible();
});
