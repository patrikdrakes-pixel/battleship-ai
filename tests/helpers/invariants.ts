import { expect } from 'vitest';
import { coordKey, shipCells } from '../../src/engine/board';
import { BOARD_SIZE, FLEET } from '../../src/engine/constants';
import type { Board, Shot } from '../../src/engine/types';

/**
 * `ships`, `grid` and `shipAt` are intentionally denormalized. This asserts they
 * agree with each other and with the shot history that produced the board.
 */
export function assertBoardConsistent(board: Board, shots: readonly Shot[] = []): void {
  expect(board.grid).toHaveLength(BOARD_SIZE);
  expect(board.shipAt).toHaveLength(BOARD_SIZE);
  for (const row of board.grid) expect(row).toHaveLength(BOARD_SIZE);
  for (const row of board.shipAt) expect(row).toHaveLength(BOARD_SIZE);

  const shipIds = new Set(board.ships.map((ship) => ship.id));
  const indexedCells = new Map<string, string[]>();

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const state = board.grid[r][c];
      const id = board.shipAt[r][c];
      if (id === null) {
        // Only water lives outside the index.
        expect(state === 'empty' || state === 'miss').toBe(true);
      } else {
        expect(shipIds.has(id)).toBe(true);
        expect(state === 'ship' || state === 'hit').toBe(true);
        const cells = indexedCells.get(id) ?? [];
        cells.push(coordKey({ r, c }));
        indexedCells.set(id, cells);
      }
    }
  }

  const shotsAt = new Map(shots.map((shot) => [coordKey(shot.coord), shot]));

  for (const ship of board.ships) {
    const footprint = shipCells(ship);
    expect(footprint).toHaveLength(ship.size);
    for (const cell of footprint) {
      expect(cell.r).toBeGreaterThanOrEqual(0);
      expect(cell.c).toBeGreaterThanOrEqual(0);
      expect(cell.r).toBeLessThan(BOARD_SIZE);
      expect(cell.c).toBeLessThan(BOARD_SIZE);
    }
    // The index attributes exactly the footprint to this ship, nothing else.
    expect([...(indexedCells.get(ship.id) ?? [])].sort()).toEqual(
      footprint.map(coordKey).sort(),
    );

    const hitCells = footprint.filter((cell) => board.grid[cell.r][cell.c] === 'hit');
    expect(ship.hits).toBe(hitCells.length);
    expect(ship.hits).toBeGreaterThanOrEqual(0);
    expect(ship.hits).toBeLessThanOrEqual(ship.size);

    // Hit count matches the shot history.
    if (shots.length > 0) {
      const shotsOnShip = footprint.filter((cell) => shotsAt.has(coordKey(cell)));
      expect(ship.hits).toBe(shotsOnShip.length);
    }

    const sunk = ship.hits === ship.size;
    expect(sunk).toBe(hitCells.length === ship.size);
  }

  if (board.ships.length > 0) {
    expect(board.ships.map((ship) => ship.size).sort()).toEqual(
      FLEET.map((entry) => entry.size).sort(),
    );
  }

  if (shots.length === 0) return;

  // Grid agrees with the shot history in both directions.
  for (const shot of shots) {
    const { r, c } = shot.coord;
    const expected = board.shipAt[r][c] === null ? 'miss' : 'hit';
    expect(board.grid[r][c]).toBe(expected);
    expect(shot.outcome.kind).not.toBe('repeat');
    if (shot.outcome.kind === 'miss') expect(board.shipAt[r][c]).toBeNull();
    else if (shot.outcome.kind !== 'repeat') expect(board.shipAt[r][c]).not.toBeNull();
  }
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const state = board.grid[r][c];
      const wasShot = shotsAt.has(coordKey({ r, c }));
      expect(wasShot).toBe(state === 'hit' || state === 'miss');
    }
  }
}
