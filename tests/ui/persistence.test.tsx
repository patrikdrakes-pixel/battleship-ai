import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { shipCells } from '../../src/engine/board';
import { newGame } from '../../src/engine/game';
import { App } from '../../src/ui/App';
import { loadPreferences, loadRecord } from '../../src/ui/storage';

const COLUMNS = 'ABCDEFGHIJ';

function cellLabel({ r, c }: { r: number; c: number }): string {
  return `${COLUMNS[c]}${r + 1}`;
}

function enemyCell(label: string): HTMLElement {
  const cell = within(screen.getByTestId('enemy-board'))
    .getAllByRole('button')
    .find((candidate) => candidate.dataset.cell === label);
  if (cell === undefined) throw new Error(`missing cell ${label}`);
  return cell;
}

/** Fires at every enemy ship cell, which always ends in a player win. */
async function winTheGame(user: ReturnType<typeof userEvent.setup>) {
  for (const label of newGame(5).ai.ships.flatMap(shipCells).map(cellLabel)) {
    if (screen.queryByTestId('game-over') !== null) break;
    await act(async () => {
      await user.click(enemyCell(label));
    });
  }
}

describe('persisted preferences and record', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores the stored difficulty and mute preference', () => {
    localStorage.setItem(
      'battleship.preferences',
      JSON.stringify({ difficulty: 'hard', muted: true }),
    );

    render(<App seed={5} aiDelayMs={0} />);

    expect(screen.getByTestId('difficulty')).toHaveValue('hard');
    expect(screen.getByTestId('mute-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('stores difficulty and mute changes', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);

    await act(async () => {
      await user.selectOptions(screen.getByTestId('difficulty'), 'easy');
    });
    await act(async () => {
      await user.click(screen.getByTestId('mute-toggle'));
    });

    expect(loadPreferences()).toEqual({ difficulty: 'easy', muted: true });
  });

  it('counts a finished game once and shows the record in the overlay', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);

    await winTheGame(user);

    const overlay = screen.getByTestId('game-over');
    expect(within(overlay).getByTestId('stat-record')).toHaveTextContent('1W – 0L');
    expect(loadRecord()).toEqual({ wins: 1, losses: 0 });

    // Re-rendering the finished game must not count it a second time.
    await act(async () => {
      await user.click(
        within(overlay).getByRole('button', { name: 'Review the boards' }),
      );
    });
    expect(loadRecord()).toEqual({ wins: 1, losses: 0 });

    cleanup();
    render(<App seed={5} aiDelayMs={0} />);
    await winTheGame(user);
    expect(loadRecord()).toEqual({ wins: 2, losses: 0 });
  });
});
