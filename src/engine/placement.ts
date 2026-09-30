import { canPlace, createEmptyBoard, placeShip, shipCells } from './board';
import { BOARD_SIZE, FLEET } from './constants';
import type { FleetEntry } from './constants';
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

/** Fleet entries still missing from `board`, in canonical fleet order. */
export function remainingFleet(board: Board): readonly FleetEntry[] {
  return FLEET.filter((entry) => !board.ships.some((ship) => ship.id === entry.id));
}

export function isFleetComplete(board: Board): boolean {
  return remainingFleet(board).length === 0;
}

/**
 * Guards a board that did not come from `randomPlacement` (a manual layout
 * arriving from the UI): the fleet must be complete, correctly sized, in
 * bounds, non-overlapping and unfired.
 */
export function assertPlaceableFleet(board: Board): void {
  if (board.ships.length !== FLEET.length) {
    throw new Error(`Expected ${FLEET.length} ships, got ${board.ships.length}`);
  }
  for (const entry of FLEET) {
    const ship = board.ships.find((candidate) => candidate.id === entry.id);
    if (ship === undefined) throw new Error(`Missing ship ${entry.id}`);
    if (ship.size !== entry.size) {
      throw new Error(`Ship ${entry.id} has size ${ship.size}, expected ${entry.size}`);
    }
    if (ship.hits !== 0) throw new Error(`Ship ${entry.id} is already damaged`);
    for (const cell of shipCells(ship)) {
      if (board.shipAt[cell.r]?.[cell.c] !== entry.id) {
        throw new Error(`Ship ${entry.id} is out of bounds or overlapping`);
      }
    }
  }
  for (const row of board.grid) {
    for (const state of row) {
      if (state !== 'empty' && state !== 'ship') {
        throw new Error('Board has already been fired at');
      }
    }
  }
}
