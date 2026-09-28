import { describe, expect, it } from 'vitest';
import { shipCells } from '../../src/engine/board';
import { BOARD_SIZE } from '../../src/engine/constants';
import { newGame, playerFire } from '../../src/engine/game';
import type { Coord, GameState } from '../../src/engine/types';
import { gameSummary } from '../../src/ui/stats';

function firstWaterCell(state: GameState): Coord {
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (state.ai.shipAt[r][c] === null) return { r, c };
    }
  }
  throw new Error('board is all ships');
}

describe('gameSummary', () => {
  it('reports zeroes for a fresh game', () => {
    expect(gameSummary(newGame(7))).toEqual({
      shots: 0,
      hits: 0,
      accuracy: 0,
      shipsSunk: 0,
      shipsLost: 0,
    });
  });

  it('counts hits and sinks and rounds the hit rate', () => {
    let state: GameState = newGame(7);
    const destroyer = state.ai.ships.find((ship) => ship.id === 'destroyer');
    if (destroyer === undefined) throw new Error('missing destroyer');
    const targets = [...shipCells(destroyer), firstWaterCell(state)];

    for (const coord of targets) {
      // Skip the AI reply: the summary only reads the player's own shots.
      state = { ...playerFire(state, coord).state, turn: 'player' };
    }

    expect(gameSummary(state)).toEqual({
      shots: 3,
      hits: 2,
      accuracy: 67,
      shipsSunk: 1,
      shipsLost: 0,
    });
  });
});
