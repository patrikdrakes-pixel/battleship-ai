import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { shipCells } from '../src/engine/board';
import { BOARD_SIZE } from '../src/engine/constants';
import { newGame } from '../src/engine/game';
import { cellLabel } from '../src/ui/labels';

const SEED = 20260926;

/**
 * The engine is deterministic for a given seed, so the test can compute the
 * enemy layout the app will generate and drive the game to a known outcome.
 */
function layout(seed: number) {
  const state = newGame(seed);
  const enemyShipLabels = state.ai.ships
    .flatMap((ship) => shipCells(ship))
    .map(cellLabel);
  const enemyWaterLabels: string[] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (state.ai.shipAt[r][c] === null) enemyWaterLabels.push(cellLabel({ r, c }));
    }
  }
  return { enemyShipLabels, enemyWaterLabels };
}

async function open(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}&delay=0`);
  await expect(page.getByRole('heading', { name: 'Battleship' })).toBeVisible();
}

function enemyCell(page: Page, label: string) {
  return page.getByTestId('enemy-board').locator(`[data-cell="${label}"]`);
}

/** Cells are also disabled while the AI replies, so wait for the turn first. */
async function fireAt(page: Page, label: string): Promise<void> {
  await expect(page.getByTestId('status')).not.toContainText('Enemy is firing');
  await enemyCell(page, label).click();
}

async function isOver(page: Page): Promise<boolean> {
  await expect(page.getByTestId('status')).not.toContainText('Enemy is firing');
  const text = (await page.getByTestId('status').textContent()) ?? '';
  return text.includes('lose') || text.includes('win');
}

async function alreadyFired(page: Page, label: string): Promise<boolean> {
  return (await enemyCell(page, label).getAttribute('data-fired')) === 'true';
}

test('renders both 10x10 boards with a hidden enemy fleet', async ({ page }) => {
  await open(page, SEED);
  await expect(page.getByTestId('enemy-board').getByRole('button')).toHaveCount(100);
  await expect(page.getByTestId('player-board').getByRole('img')).toHaveCount(100);
  await expect(
    page.getByTestId('player-board').locator('[data-state="ship"]'),
  ).toHaveCount(17);
  await expect(
    page.getByTestId('enemy-board').locator('[data-state="ship"]'),
  ).toHaveCount(0);
  await expect(page.getByTestId('status')).toContainText('Your turn');
});

test('reports hit, miss and sunk, and never fires twice at a cell', async ({ page }) => {
  await open(page, SEED);
  const { enemyShipLabels, enemyWaterLabels } = layout(SEED);

  await fireAt(page, enemyWaterLabels[0]);
  await expect(enemyCell(page, enemyWaterLabels[0])).toHaveAttribute(
    'data-state',
    'miss',
  );
  await expect(enemyCell(page, enemyWaterLabels[0])).toBeDisabled();
  await expect(page.getByTestId('shot-log')).toContainText('miss');

  await fireAt(page, enemyShipLabels[0]);
  await expect(enemyCell(page, enemyShipLabels[0])).toHaveAttribute('data-state', 'hit');
  await expect(page.getByTestId('shot-log')).toContainText('hit');

  // The destroyer is the 2-cell ship; sinking it must be announced by name.
  const destroyer = newGame(SEED).ai.ships.find((ship) => ship.id === 'destroyer');
  if (destroyer === undefined) throw new Error('missing destroyer');
  for (const cell of shipCells(destroyer)) {
    const label = cellLabel(cell);
    if (await alreadyFired(page, label)) continue;
    await fireAt(page, label);
  }
  await expect(page.getByTestId('shot-log')).toContainText('sunk the Destroyer');
});

test('player can win by sinking the whole enemy fleet', async ({ page }) => {
  await open(page, SEED);
  const { enemyShipLabels } = layout(SEED);

  for (const label of enemyShipLabels) {
    await fireAt(page, label);
  }

  await expect(page.getByTestId('status')).toContainText('You win!');
  await expect(page.getByTestId('enemy-board').locator('[data-state="hit"]')).toHaveCount(
    17,
  );
});

test('player can lose when the AI destroys their fleet', async ({ page }) => {
  await open(page, SEED);
  const { enemyWaterLabels } = layout(SEED);

  for (const label of enemyWaterLabels) {
    if (await isOver(page)) break;
    if (await alreadyFired(page, label)) continue;
    await fireAt(page, label);
  }

  await expect(page.getByTestId('status')).toContainText('You lose');
  await expect(
    page.getByTestId('player-board').locator('[data-state="hit"]'),
  ).toHaveCount(17);
});

test('sunk ships are styled apart from plain hits', async ({ page }) => {
  await open(page, SEED);
  const destroyer = newGame(SEED).ai.ships.find((ship) => ship.id === 'destroyer');
  if (destroyer === undefined) throw new Error('missing destroyer');
  const labels = shipCells(destroyer).map(cellLabel);

  await fireAt(page, labels[0]);
  await expect(enemyCell(page, labels[0])).toHaveAttribute('data-sunk', 'false');

  for (const label of labels.slice(1)) await fireAt(page, label);
  for (const label of labels) {
    await expect(enemyCell(page, label)).toHaveAttribute('data-sunk', 'true');
  }
});

test('fits a 320px viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await open(page, SEED);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(enemyCell(page, 'J10')).toBeInViewport();
});

test('new game resets the board', async ({ page }) => {
  await open(page, SEED);
  const { enemyWaterLabels } = layout(SEED);

  await fireAt(page, enemyWaterLabels[0]);
  await expect(
    page.getByTestId('enemy-board').locator('[data-state="miss"]'),
  ).toHaveCount(1);

  await page.getByRole('button', { name: 'New game' }).click();
  await expect(
    page.getByTestId('enemy-board').locator('[data-state="miss"]'),
  ).toHaveCount(0);
  await expect(page.getByTestId('enemy-board').locator('[data-state="hit"]')).toHaveCount(
    0,
  );
  await expect(page.getByTestId('status')).toContainText('Your turn');
  await expect(page.getByTestId('shot-log')).toHaveText('');
});
