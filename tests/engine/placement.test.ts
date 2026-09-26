import { describe, expect, it } from 'vitest';
import { coordKey, shipCells } from '../../src/engine/board';
import { BOARD_SIZE, FLEET } from '../../src/engine/constants';
import { randomPlacement } from '../../src/engine/placement';
import { mulberry32 } from '../../src/engine/rng';
import { assertBoardConsistent } from '../helpers/invariants';

describe('randomPlacement', () => {
  it('always produces a legal fleet', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const board = randomPlacement(mulberry32(seed));
      expect(board.ships).toHaveLength(FLEET.length);
      expect(board.ships.map((ship) => ship.size).sort()).toEqual([2, 3, 3, 4, 5]);

      const occupied = new Set<string>();
      for (const ship of board.ships) {
        for (const cell of shipCells(ship)) {
          expect(cell.r).toBeGreaterThanOrEqual(0);
          expect(cell.c).toBeGreaterThanOrEqual(0);
          expect(cell.r).toBeLessThan(BOARD_SIZE);
          expect(cell.c).toBeLessThan(BOARD_SIZE);
          expect(occupied.has(coordKey(cell))).toBe(false);
          occupied.add(coordKey(cell));
        }
      }
      expect(occupied.size).toBe(17);
      assertBoardConsistent(board, []);
    }
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const a = randomPlacement(mulberry32(42));
    const b = randomPlacement(mulberry32(42));
    const c = randomPlacement(mulberry32(43));
    expect(a.grid).toEqual(b.grid);
    expect(a.grid).not.toEqual(c.grid);
  });

  it('uses both orientations across seeds', () => {
    const orientations = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      for (const ship of randomPlacement(mulberry32(seed)).ships) {
        orientations.add(ship.orientation);
      }
    }
    expect([...orientations].sort()).toEqual(['H', 'V']);
  });
});
