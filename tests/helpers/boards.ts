import { createEmptyBoard, placeShip } from '../../src/engine/board';
import type { Board, Coord } from '../../src/engine/types';

/** A deterministic full fleet, including a ship flush against the bottom-right corner. */
export function fixedBoard(): Board {
  let board = createEmptyBoard();
  board = placeShip(board, 'carrier', { r: 0, c: 0 }, 'H', 5);
  board = placeShip(board, 'battleship', { r: 2, c: 0 }, 'V', 4);
  board = placeShip(board, 'cruiser', { r: 5, c: 5 }, 'H', 3);
  board = placeShip(board, 'submarine', { r: 9, c: 7 }, 'H', 3);
  board = placeShip(board, 'destroyer', { r: 7, c: 0 }, 'V', 2);
  return board;
}

export function coord(r: number, c: number): Coord {
  return { r, c };
}
