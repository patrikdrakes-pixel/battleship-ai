import { describe, expect, it } from 'vitest';
import {
  applyShot,
  canPlace,
  createEmptyBoard,
  isFleetSunk,
  placeShip,
} from '../../src/engine/board';
import { BOARD_SIZE } from '../../src/engine/constants';
import type { Board, Shot } from '../../src/engine/types';
import { coord, fixedBoard } from '../helpers/boards';
import { assertBoardConsistent } from '../helpers/invariants';

function fire(board: Board, shots: Shot[], r: number, c: number): Board {
  const { board: next, outcome } = applyShot(board, coord(r, c));
  if (outcome.kind !== 'repeat') shots.push({ coord: coord(r, c), outcome });
  return next;
}

describe('board placement', () => {
  it('rejects placements that leave the board', () => {
    const board = createEmptyBoard();
    expect(canPlace(board, coord(0, 6), 'H', 5)).toBe(false);
    expect(canPlace(board, coord(6, 0), 'V', 5)).toBe(false);
    expect(canPlace(board, coord(0, 5), 'H', 5)).toBe(true);
    expect(() => placeShip(board, 'carrier', coord(0, 6), 'H', 5)).toThrow();
  });

  it('rejects overlapping placements', () => {
    const board = placeShip(createEmptyBoard(), 'carrier', coord(4, 2), 'H', 5);
    expect(canPlace(board, coord(0, 4), 'V', 5)).toBe(false);
    expect(canPlace(board, coord(0, 1), 'V', 4)).toBe(true);
  });

  it('keeps ships, grid and shipAt consistent after initial placement', () => {
    assertBoardConsistent(fixedBoard(), []);
  });
});

describe('denormalized state stays consistent', () => {
  it('after a miss', () => {
    const shots: Shot[] = [];
    const board = fire(fixedBoard(), shots, 4, 4);
    expect(shots[0].outcome.kind).toBe('miss');
    expect(board.grid[4][4]).toBe('miss');
    expect(board.shipAt[4][4]).toBeNull();
    assertBoardConsistent(board, shots);
  });

  it('after a hit', () => {
    const shots: Shot[] = [];
    const board = fire(fixedBoard(), shots, 0, 2);
    expect(shots[0].outcome).toEqual({ kind: 'hit', shipId: 'carrier' });
    expect(board.grid[0][2]).toBe('hit');
    expect(board.shipAt[0][2]).toBe('carrier');
    expect(board.ships.find((ship) => ship.id === 'carrier')?.hits).toBe(1);
    assertBoardConsistent(board, shots);
  });

  it('after a sunk ship', () => {
    const shots: Shot[] = [];
    let board = fixedBoard();
    board = fire(board, shots, 7, 0);
    board = fire(board, shots, 8, 0);
    expect(shots[1].outcome).toEqual({ kind: 'sunk', shipId: 'destroyer', size: 2 });
    expect(board.ships.find((ship) => ship.id === 'destroyer')?.hits).toBe(2);
    assertBoardConsistent(board, shots);
  });

  it('after the whole fleet is sunk', () => {
    const shots: Shot[] = [];
    let board = fixedBoard();
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        board = fire(board, shots, r, c);
      }
    }
    expect(isFleetSunk(board)).toBe(true);
    expect(shots).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    assertBoardConsistent(board, shots);
  });
});

describe('applyShot', () => {
  it('reports repeats without changing the board', () => {
    const first = applyShot(fixedBoard(), coord(0, 0));
    const second = applyShot(first.board, coord(0, 0));
    expect(second.outcome).toEqual({ kind: 'repeat' });
    expect(second.board).toBe(first.board);
  });

  it('does not mutate the previous board', () => {
    const before = fixedBoard();
    const after = applyShot(before, coord(0, 0)).board;
    expect(before.grid[0][0]).toBe('ship');
    expect(after.grid[0][0]).toBe('hit');
    expect(before.ships.find((ship) => ship.id === 'carrier')?.hits).toBe(0);
  });

  it('rejects shots outside the board', () => {
    expect(() => applyShot(fixedBoard(), coord(-1, 0))).toThrow();
    expect(() => applyShot(fixedBoard(), coord(0, BOARD_SIZE))).toThrow();
  });

  it('reports sunk only on the ship that was completed', () => {
    let board = fixedBoard();
    const shots: Shot[] = [];
    board = fire(board, shots, 9, 7);
    board = fire(board, shots, 9, 8);
    board = fire(board, shots, 0, 0);
    expect(shots[2].outcome).toEqual({ kind: 'hit', shipId: 'carrier' });
    board = fire(board, shots, 9, 9);
    expect(shots[3].outcome).toEqual({ kind: 'sunk', shipId: 'submarine', size: 3 });
    assertBoardConsistent(board, shots);
  });
});
