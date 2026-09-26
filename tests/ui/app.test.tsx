import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';

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
