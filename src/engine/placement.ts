import { canPlace, createEmptyBoard, placeShip } from './board';
import { BOARD_SIZE, FLEET } from './constants';
import type { Rng } from './rng';
import type { Board, Orientation } from './types';

const MAX_ATTEMPTS_PER_SHIP = 500;

/**
 * Places the whole fleet at random legal positions: in bounds and non-overlapping.
 * Restarts from scratch if a ship cannot be placed, which keeps every layout
 * uniformly drawn from the attempted sequence rather than biased by backtracking.
 */
export function randomPlacement(rng: Rng): Board {
  for (let restart = 0; restart < 50; restart += 1) {
    const board = tryPlaceFleet(rng);
    if (board !== null) return board;
  }
  throw new Error('Failed to generate a legal fleet placement');
}

function tryPlaceFleet(rng: Rng): Board | null {
  let board = createEmptyBoard();
  for (const entry of FLEET) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SHIP && !placed; attempt += 1) {
      const orientation: Orientation = rng.nextInt(2) === 0 ? 'H' : 'V';
      const maxRow = orientation === 'V' ? BOARD_SIZE - entry.size + 1 : BOARD_SIZE;
      const maxCol = orientation === 'H' ? BOARD_SIZE - entry.size + 1 : BOARD_SIZE;
      const origin = { r: rng.nextInt(maxRow), c: rng.nextInt(maxCol) };
      if (canPlace(board, origin, orientation, entry.size)) {
        board = placeShip(board, entry.id, origin, orientation, entry.size);
        placed = true;
      }
    }
    if (!placed) return null;
  }
  return board;
}
