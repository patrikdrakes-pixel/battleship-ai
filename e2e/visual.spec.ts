import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { shipCells } from '../src/engine/board';
import { BOARD_SIZE } from '../src/engine/constants';
import { newGame } from '../src/engine/game';
import { cellLabel } from '../src/ui/labels';

/**
 * Visual regression: styling is the one layer unit and E2E assertions barely
 * cover, so each distinct board state is pinned as a screenshot. Snapshots are
 * per project (desktop and mobile), taken with animations disabled and a fixed
 * seed so the fleet layout is identical on every run.
 *
 * Pixel output depends on the OS font stack, so these run only inside the
 * pinned Playwright container (`npm run e2e:visual`, CI job "Visual
 * regression"); the plain E2E run skips them via `--grep-invert @visual`.
 */
const SEED = 20260926;

async function open(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}&delay=0`);
  await expect(page.getByRole('heading', { name: 'Battleship' })).toBeVisible();
}

function enemyCell(page: Page, label: string) {
  return page.getByTestId('enemy-board').locator(`[data-cell="${label}"]`);
}

async function fireAt(page: Page, label: string): Promise<void> {
  await expect(page.getByTestId('status')).not.toContainText('Enemy is firing');
  await enemyCell(page, label).click();
}

function enemyLabels() {
  const state = newGame(SEED);
  const ship = state.ai.ships.flatMap((s) => shipCells(s)).map(cellLabel);
  const water: string[] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (state.ai.shipAt[r][c] === null) water.push(cellLabel({ r, c }));
    }
  }
  return { ship, water };
}

test('fresh game @visual', async ({ page }) => {
  await open(page);
  await expect(page).toHaveScreenshot('fresh-game.png', { fullPage: true });
});

test('board with a miss, a hit and a sunk ship @visual', async ({ page }) => {
  await open(page);
  const { water } = enemyLabels();
  const destroyer = newGame(SEED).ai.ships.find((ship) => ship.id === 'destroyer');
  if (destroyer === undefined) throw new Error('missing destroyer');
  const [bow, stern] = shipCells(destroyer).map(cellLabel);

  await fireAt(page, water[0]);
  await fireAt(page, bow);
  await fireAt(page, stern);
  await expect(enemyCell(page, stern)).toHaveAttribute('data-sunk', 'true');

  // Full page: the AI's replies land on the player board and in the shot log.
  await expect(page).toHaveScreenshot('shot-states.png', { fullPage: true });
});

test('end-game overlay @visual', async ({ page }) => {
  await open(page);
  const { ship } = enemyLabels();
  for (const label of ship) await fireAt(page, label);

  const overlay = page.getByTestId('game-over');
  await expect(overlay).toContainText('Victory');
  await expect(overlay).toHaveScreenshot('game-over.png');
});
