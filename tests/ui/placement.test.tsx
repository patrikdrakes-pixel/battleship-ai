import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FLEET } from '../../src/engine/constants';
import { App } from '../../src/ui/App';

function placementCell(label: string): HTMLElement {
  const cell = within(screen.getByTestId('placement-board'))
    .getAllByRole('button')
    .find((candidate) => candidate.dataset.cell === label);
  if (cell === undefined) throw new Error(`missing cell ${label}`);
  return cell;
}

async function openPlacement(user: ReturnType<typeof userEvent.setup>) {
  await act(async () => {
    await user.click(screen.getByTestId('place-ships'));
  });
}

/** Places the whole fleet horizontally, one ship per row. */
async function placeFleet(user: ReturnType<typeof userEvent.setup>) {
  for (let row = 0; row < FLEET.length; row += 1) {
    await act(async () => {
      await user.click(placementCell(`A${row + 1}`));
    });
  }
}

describe('manual ship placement', () => {
  it('places the fleet and starts a game with that layout', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);
    await openPlacement(user);

    expect(screen.getByTestId('placement-current')).toHaveTextContent(
      'Placing Carrier (5 cells, horizontal)',
    );
    await placeFleet(user);
    expect(screen.getByTestId('placement-current')).toHaveTextContent('Fleet complete');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Start battle' }));
    });

    const own = within(screen.getByTestId('player-board')).getAllByRole('img');
    expect(own.filter((cell) => cell.dataset.state === 'ship')).toHaveLength(17);
    for (let row = 0; row < FLEET.length; row += 1) {
      const label = `A${row + 1}`;
      expect(
        own.find((cell) => cell.getAttribute('aria-label')?.startsWith(label + ' '))
          ?.dataset.state,
      ).toBe('ship');
    }
    expect(screen.getByTestId('status')).toHaveTextContent('Your turn');
  });

  it('ignores an overlapping placement and keeps the ship pending', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);
    await openPlacement(user);

    await act(async () => {
      await user.click(placementCell('A1'));
    });
    expect(screen.getByTestId('placement-current')).toHaveTextContent(
      'Placing Battleship',
    );

    await act(async () => {
      await user.click(placementCell('A1'));
    });
    expect(screen.getByTestId('placement-current')).toHaveTextContent(
      'Placing Battleship',
    );
    expect(
      within(screen.getByTestId('placement-board'))
        .getAllByRole('button')
        .filter((cell) => cell.dataset.state === 'ship'),
    ).toHaveLength(5);
  });

  it('cannot start until the fleet is complete, and rotate flips the orientation', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);
    await openPlacement(user);

    expect(screen.getByRole('button', { name: 'Start battle' })).toBeDisabled();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Rotate' }));
    });
    expect(screen.getByTestId('placement-current')).toHaveTextContent('vertical');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Random fleet' }));
    });
    expect(screen.getByRole('button', { name: 'Start battle' })).toBeEnabled();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Clear' }));
    });
    expect(screen.getByRole('button', { name: 'Start battle' })).toBeDisabled();
  });

  it('cancels back to the running game without changing it', async () => {
    const user = userEvent.setup();
    render(<App seed={5} aiDelayMs={0} />);
    const before = within(screen.getByTestId('player-board'))
      .getAllByRole('img')
      .map((cell) => cell.dataset.state)
      .join('');

    await openPlacement(user);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    const after = within(screen.getByTestId('player-board'))
      .getAllByRole('img')
      .map((cell) => cell.dataset.state)
      .join('');
    expect(after).toBe(before);
  });
});
