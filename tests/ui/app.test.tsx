import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { shipCells } from '../../src/engine/board';
import { newGame } from '../../src/engine/game';
import { App } from '../../src/ui/App';
import { cellLabel } from '../../src/ui/labels';

function enemyCells(): HTMLElement[] {
  return within(screen.getByTestId('enemy-board')).getAllByRole('button');
}

describe('App', () => {
  it('renders two 10x10 boards and the fleet roster', () => {
    render(<App seed={5} aiDelayMs={0} />);
    expect(enemyCells()).toHaveLength(100);
    expect(within(screen.getByTestId('player-board')).getAllByRole('img')).toHaveLength(
      100,
    );
    expect(screen.getByLabelText('Enemy fleet')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('Your turn');
  });

  it('hides enemy ships but reveals the player fleet', () => {
    render(<App seed={5} aiDelayMs={0} />);
    expect(enemyCells().filter((cell) => cell.dataset.state === 'ship')).toHaveLength(0);
    const own = within(screen.getByTestId('player-board')).getAllByRole('img');
    expect(own.filter((cell) => cell.dataset.state === 'ship')).toHaveLength(17);
  });

  it('does not reveal which enemy ship an unsunk hit belongs to', async () => {
    const user = userEvent.setup();
    const carrier = newGame(5).ai.ships.find((ship) => ship.id === 'carrier');
    if (carrier === undefined) throw new Error('missing carrier');
    const label = cellLabel(shipCells(carrier)[0]);

    render(<App seed={5} aiDelayMs={0} />);
    const panel = screen.getByLabelText('Enemy fleet');
    expect(within(panel).getAllByText('AFLOAT')).toHaveLength(5);

    const target = enemyCells().find((cell) => cell.dataset.cell === label);
    if (target === undefined) throw new Error(`missing cell ${label}`);
    await act(async () => {
      await user.click(target);
    });

    await waitFor(() => {
      expect(
        enemyCells().find((cell) => cell.dataset.cell === label)?.dataset.state,
      ).toBe('hit');
    });
    expect(within(panel).getAllByText('AFLOAT')).toHaveLength(5);
    expect(panel).not.toHaveTextContent('1/5');
  });

  it('marks a fired cell, disables it and lets the AI reply', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);
    const target = enemyCells()[0];

    await act(async () => {
      await user.click(target);
    });

    await waitFor(() => {
      expect(enemyCells()[0]).toBeDisabled();
    });
    expect(['hit', 'miss']).toContain(enemyCells()[0].dataset.state);
    await waitFor(() => {
      expect(screen.getByTestId('shot-log')).toHaveTextContent('Enemy fired at');
    });
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Your turn');
    });
  });

  it('explains every shot state in the legend', () => {
    render(<App seed={5} aiDelayMs={0} />);
    const legend = screen.getByTestId('legend');
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['Untouched', 'Miss', 'Hit', 'Sunk']);
  });

  it('marks only the newest shot on each board', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);

    await act(async () => {
      await user.click(enemyCells()[0]);
    });
    await waitFor(() => {
      expect(enemyCells()[0].dataset.last).toBe('true');
    });
    await waitFor(() => {
      expect(
        within(screen.getByTestId('player-board'))
          .getAllByRole('img')
          .filter((cell) => cell.dataset.last === 'true'),
      ).toHaveLength(1);
    });

    await act(async () => {
      await user.click(enemyCells()[1]);
    });
    await waitFor(() => {
      expect(enemyCells()[1].dataset.last).toBe('true');
    });
    expect(enemyCells()[0].dataset.last).toBe('false');
  });

  it('draws the player fleet as hulls and keeps enemy hulls hidden', () => {
    render(<App seed={5} aiDelayMs={0} />);
    const own = within(screen.getByTestId('player-board')).getByTestId('ship-layer');
    expect(own.querySelectorAll('[data-ship]')).toHaveLength(5);
    const enemy = within(screen.getByTestId('enemy-board')).getByTestId('ship-layer');
    expect(enemy.querySelectorAll('[data-ship]')).toHaveLength(0);
  });

  it('draws an enemy hull once that ship is sunk', async () => {
    const user = userEvent.setup();
    const destroyer = newGame(5).ai.ships.find((ship) => ship.id === 'destroyer');
    if (destroyer === undefined) throw new Error('missing destroyer');
    const labels = shipCells(destroyer).map(cellLabel);

    render(<App seed={5} aiDelayMs={0} />);
    const enemyLayer = () =>
      within(screen.getByTestId('enemy-board')).getByTestId('ship-layer');

    for (const label of labels) {
      const target = enemyCells().find((cell) => cell.dataset.cell === label);
      if (target === undefined) throw new Error(`missing cell ${label}`);
      await act(async () => {
        await user.click(target);
      });
      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('Your turn');
      });
    }

    await waitFor(() => {
      expect(enemyLayer().querySelectorAll('[data-ship="destroyer"]')).toHaveLength(1);
    });
    expect(enemyLayer().querySelectorAll('[data-ship]')).toHaveLength(1);
  });

  it('shows the end-game overlay with stats and restarts from it', async () => {
    const user = userEvent.setup();
    const targets = newGame(5).ai.ships.flatMap(shipCells).map(cellLabel);

    render(<App seed={5} aiDelayMs={0} />);
    for (const label of targets) {
      const target = enemyCells().find((cell) => cell.dataset.cell === label);
      if (target === undefined) throw new Error(`missing cell ${label}`);
      await act(async () => {
        await user.click(target);
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-over')).toHaveTextContent('Victory');
    });
    expect(screen.getByTestId('stat-shots')).toHaveTextContent('17');
    expect(screen.getByTestId('stat-accuracy')).toHaveTextContent('100%');
    expect(screen.getByTestId('stat-sunk')).toHaveTextContent('5/5');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Play again' }));
    });
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('Your turn');
  });

  it('can dismiss the overlay to review the revealed boards', async () => {
    const user = userEvent.setup();
    const targets = newGame(5).ai.ships.flatMap(shipCells).map(cellLabel);

    render(<App seed={5} aiDelayMs={0} />);
    for (const label of targets) {
      const target = enemyCells().find((cell) => cell.dataset.cell === label);
      if (target === undefined) throw new Error(`missing cell ${label}`);
      await act(async () => {
        await user.click(target);
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-over')).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Review the boards' }));
    });

    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument();
    const enemy = within(screen.getByTestId('enemy-board')).getByTestId('ship-layer');
    expect(enemy.querySelectorAll('[data-ship]')).toHaveLength(5);
  });

  it('offers the three difficulties and defaults to medium', () => {
    render(<App seed={5} aiDelayMs={0} />);
    const select = screen.getByTestId('difficulty');
    expect(select).toHaveValue('medium');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Easy', 'Medium', 'Hard']);
  });

  it('starts a fresh game on the chosen difficulty and keeps it across New game', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);

    await act(async () => {
      await user.click(enemyCells()[0]);
    });
    await waitFor(() => {
      expect(screen.getByTestId('shot-log')).toHaveTextContent('You fired at');
    });

    const select = screen.getByTestId('difficulty');
    await act(async () => {
      await user.selectOptions(select, 'hard');
    });
    expect(select).toHaveValue('hard');
    expect(enemyCells().filter((cell) => cell.dataset.fired === 'true')).toHaveLength(0);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'New game' }));
    });
    expect(screen.getByTestId('difficulty')).toHaveValue('hard');
  });

  it('starts a fresh game when New game is pressed', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);

    await act(async () => {
      await user.click(enemyCells()[0]);
    });
    await waitFor(() => {
      expect(screen.getByTestId('shot-log')).toHaveTextContent('You fired at');
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'New game' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('shot-log')).toHaveTextContent('');
    });
    expect(enemyCells().filter((cell) => cell.dataset.state !== 'empty')).toHaveLength(0);
    expect(screen.getByTestId('status')).toHaveTextContent('Your turn');
  });
});
