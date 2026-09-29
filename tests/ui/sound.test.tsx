import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { shipCells } from '../../src/engine/board';
import { newGame } from '../../src/engine/game';
import { App } from '../../src/ui/App';
import type { SoundName, SoundPlayer } from '../../src/ui/sound';
import { createSoundPlayer } from '../../src/ui/sound';

function recorder(): { player: SoundPlayer; played: SoundName[] } {
  const played: SoundName[] = [];
  return {
    played,
    player: {
      play: (name: SoundName) => played.push(name),
      close: () => {},
    },
  };
}

function enemyCell(label: string): HTMLElement {
  const cell = within(screen.getByTestId('enemy-board'))
    .getAllByRole('button')
    .find((candidate) => candidate.dataset.cell === label);
  if (cell === undefined) throw new Error(`missing cell ${label}`);
  return cell;
}

/** Fires until the outcome of the player's own shots covers every kind we need. */
async function fireAll(
  user: ReturnType<typeof userEvent.setup>,
  labels: readonly string[],
) {
  for (const label of labels) {
    await act(async () => {
      await user.click(enemyCell(label));
    });
  }
}

const COLUMNS = 'ABCDEFGHIJ';
const ALL_CELLS = Array.from({ length: 100 }, (_, index) => {
  const column = COLUMNS[index % 10];
  return `${column}${Math.floor(index / 10) + 1}`;
});

function cellLabel({ r, c }: { r: number; c: number }): string {
  return `${COLUMNS[c]}${r + 1}`;
}

describe('sound effects', () => {
  it('plays a blip for the outcome of each shot', async () => {
    const user = userEvent.setup();
    const { player, played } = recorder();
    render(<App seed={7} aiDelayMs={0} soundPlayer={player} />);

    await fireAll(user, ALL_CELLS.slice(0, 6));

    expect(played.length).toBeGreaterThan(0);
    expect(played.every((name) => ['hit', 'miss', 'sunk'].includes(name))).toBe(true);
  });

  it('plays nothing while muted', async () => {
    const user = userEvent.setup();
    const { player, played } = recorder();
    render(<App seed={7} aiDelayMs={0} soundPlayer={player} />);

    await act(async () => {
      await user.click(screen.getByTestId('mute-toggle'));
    });
    await fireAll(user, ALL_CELLS.slice(0, 6));

    expect(played).toEqual([]);
  });

  it('toggles the mute control and reflects it to assistive technology', async () => {
    const user = userEvent.setup();
    render(<App seed={7} aiDelayMs={0} soundPlayer={recorder().player} />);
    const toggle = screen.getByTestId('mute-toggle');

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent('Sound on');

    await act(async () => {
      await user.click(toggle);
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('Sound off');

    await act(async () => {
      await user.click(toggle);
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('plays the victory fanfare when the player wins', async () => {
    const user = userEvent.setup();
    const { player, played } = recorder();
    render(<App seed={5} aiDelayMs={0} soundPlayer={player} />);

    for (const label of newGame(5).ai.ships.flatMap(shipCells).map(cellLabel)) {
      if (screen.queryByTestId('game-over') !== null) break;
      await act(async () => {
        await user.click(enemyCell(label));
      });
    }

    expect(within(screen.getByTestId('game-over')).getByText('Victory')).toBeVisible();
    expect(played).toContain('sunk');
    expect(played.at(-1)).toBe('win');
  });
});

describe('createSoundPlayer', () => {
  it('stays silent when WebAudio is unavailable', () => {
    const player = createSoundPlayer(() => null);
    expect(() => {
      player.play('hit');
      player.close();
    }).not.toThrow();
  });

  it('schedules an oscillator per tone and survives a failing context', () => {
    const oscillator = {
      type: 'sine' as OscillatorType,
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(() => ({ connect: vi.fn() })),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const createOscillator = vi.fn(() => oscillator);
    const close = vi.fn();
    const context = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator,
      createGain: vi.fn(() => gain),
      close,
      resume: vi.fn(),
    } as unknown as AudioContext;

    const create = vi.fn(() => context);
    const player = createSoundPlayer(create);
    player.play('sunk');

    expect(create).toHaveBeenCalledTimes(1);
    expect(createOscillator).toHaveBeenCalledTimes(2);
    expect(oscillator.start).toHaveBeenCalledTimes(2);

    player.play('miss');
    expect(create).toHaveBeenCalledTimes(1);

    player.close();
    expect(close).toHaveBeenCalled();

    const broken = createSoundPlayer(() => {
      throw new Error('blocked');
    });
    expect(() => broken.play('win')).not.toThrow();
  });
});
