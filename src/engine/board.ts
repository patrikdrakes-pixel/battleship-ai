import { BOARD_SIZE } from './constants';
import type {
  Board,
  CellState,
  Coord,
  Orientation,
  Ship,
  ShipId,
  ShotOutcome,
} from './types';

export function inBounds(coord: Coord, size = BOARD_SIZE): boolean {
  return coord.r >= 0 && coord.r < size && coord.c >= 0 && coord.c < size;
}

export function coordKey(coord: Coord): string {
  return `${coord.r},${coord.c}`;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

export function shipCells(ship: Pick<Ship, 'origin' | 'orientation' | 'size'>): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < ship.size; i += 1) {
    cells.push({
      r: ship.origin.r + (ship.orientation === 'V' ? i : 0),
      c: ship.origin.c + (ship.orientation === 'H' ? i : 0),
    });
  }
  return cells;
}

export function createEmptyBoard(): Board {
  const grid: CellState[][] = [];
  const shipAt: (ShipId | null)[][] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    grid.push(new Array<CellState>(BOARD_SIZE).fill('empty'));
    shipAt.push(new Array<ShipId | null>(BOARD_SIZE).fill(null));
  }
  return { ships: [], grid, shipAt };
}

export function canPlace(
  board: Board,
  origin: Coord,
  orientation: Orientation,
  size: number,
): boolean {
  const cells = shipCells({ origin, orientation, size });
  return cells.every((cell) => inBounds(cell) && board.shipAt[cell.r][cell.c] === null);
}

/** Returns a new board with the ship placed. Throws on an illegal placement. */
export function placeShip(
  board: Board,
  id: ShipId,
  origin: Coord,
  orientation: Orientation,
  size: number,
): Board {
  if (board.ships.some((ship) => ship.id === id)) {
    throw new Error(`Duplicate ship id ${id}`);
  }
  if (!canPlace(board, origin, orientation, size)) {
    throw new Error(`Illegal placement for ${id} at ${coordKey(origin)} ${orientation}`);
  }
  const ship: Ship = { id, size, origin, orientation, hits: 0 };
  const grid = board.grid.map((row) => [...row]);
  const shipAt = board.shipAt.map((row) => [...row]);
  for (const cell of shipCells(ship)) {
    grid[cell.r][cell.c] = 'ship';
    shipAt[cell.r][cell.c] = id;
  }
  return { ships: [...board.ships, ship], grid, shipAt };
}

export function isSunk(ship: Ship): boolean {
  return ship.hits >= ship.size;
}

export function isFleetSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

export interface ShotApplication {
  readonly board: Board;
  readonly outcome: ShotOutcome;
}

/**
 * Applies a shot at `coord`. Already-targeted cells yield a `repeat` outcome and
 * leave the board untouched.
 */
export function applyShot(board: Board, coord: Coord): ShotApplication {
  if (!inBounds(coord)) {
    throw new Error(`Shot out of bounds: ${coordKey(coord)}`);
  }
  const current = board.grid[coord.r][coord.c];
  if (current === 'hit' || current === 'miss') {
    return { board, outcome: { kind: 'repeat' } };
  }

  const grid = board.grid.map((row) => [...row]);
  const shipId = board.shipAt[coord.r][coord.c];
  if (shipId === null) {
    grid[coord.r][coord.c] = 'miss';
    return { board: { ...board, grid }, outcome: { kind: 'miss' } };
  }

  grid[coord.r][coord.c] = 'hit';
  const ships = board.ships.map((ship) =>
    ship.id === shipId ? { ...ship, hits: ship.hits + 1 } : ship,
  );
  const hitShip = ships.find((ship) => ship.id === shipId);
  if (hitShip === undefined) {
    throw new Error(`Board index references unknown ship ${shipId}`);
  }
  return {
    board: { ...board, grid, ships },
    outcome: isSunk(hitShip)
      ? { kind: 'sunk', shipId, size: hitShip.size }
      : { kind: 'hit', shipId },
  };
}
