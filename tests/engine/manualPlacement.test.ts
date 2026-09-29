import { describe, expect, it } from 'vitest';
import { applyShot, createEmptyBoard, placeShip } from '../../src/engine/board';
import { FLEET } from '../../src/engine/constants';
import { newGame } from '../../src/engine/game';
import {
  assertPlaceableFleet,
  isFleetComplete,
  randomPlacement,
  remainingFleet,
} from '../../src/engine/placement';
import { deriveSeed, mulberry32 } from '../../src/engine/rng';
import type { Board } from '../../src/engine/types';
import { assertBoardConsistent } from '../helpers/invariants';

/** Every ship laid out horizontally on its own row. */
function manualFleet(): Board {
  return FLEET.reduce(
    (board, entry, row) => placeShip(board, entry.id, { r: row, c: 0 }, 'H', entry.size),
    createEmptyBoard(),
  );
}

describe('remainingFleet', () => {
  it('lists the missing ships in fleet order and empties as they are placed', () => {
    let board = createEmptyBoard();
    expect(remainingFleet(board)).toEqual(FLEET);
    expect(isFleetComplete(board)).toBe(false);

    FLEET.forEach((entry, row) => {
      board = placeShip(board, entry.id, { r: row, c: 0 }, 'H', entry.size);
      expect(remainingFleet(board).map((left) => left.id)).toEqual(
        FLEET.slice(row + 1).map((left) => left.id),
      );
    });

    expect(isFleetComplete(manualFleet())).toBe(true);
  });
});

describe('assertPlaceableFleet', () => {
  it('accepts a complete manual fleet and a random one', () => {
    expect(() => assertPlaceableFleet(manualFleet())).not.toThrow();
    expect(() => assertPlaceableFleet(randomPlacement(mulberry32(7)))).not.toThrow();
  });

  it('rejects an incomplete fleet', () => {
    const board = placeShip(createEmptyBoard(), 'carrier', { r: 0, c: 0 }, 'H', 5);
    expect(() => assertPlaceableFleet(board)).toThrow(/Expected 5 ships/);
  });

  it('rejects a ship with the wrong size', () => {
    const board = manualFleet();
    const ships = board.ships.map((ship) =>
      ship.id === 'destroyer' ? { ...ship, size: 3 } : ship,
    );
    expect(() => assertPlaceableFleet({ ...board, ships })).toThrow(/size 3/);
  });

  it('rejects a ship placed out of bounds or overlapping', () => {
    const board = manualFleet();
    const ships = board.ships.map((ship) =>
      ship.id === 'carrier' ? { ...ship, origin: { r: 0, c: 8 } } : ship,
    );
    expect(() => assertPlaceableFleet({ ...board, ships })).toThrow(
      /out of bounds or overlapping/,
    );
  });

  it('rejects a board that has already been fired at', () => {
    const board = applyShot(manualFleet(), { r: 9, c: 9 }).board;
    expect(() => assertPlaceableFleet(board)).toThrow(/already been fired at/);
  });
});

describe('newGame with a manual player board', () => {
  it('uses the supplied layout and still randomizes the AI fleet', () => {
    const player = manualFleet();
    const state = newGame(11, 'hard', player);

    expect(state.player.ships).toEqual(player.ships);
    expect(state.ai.ships).toEqual(randomPlacement(mulberry32(deriveSeed(11, 1))).ships);
    expect(state.ai.grid).not.toEqual(player.grid);
    expect(state.turn).toBe('player');
    expect(state.phase).toBe('playing');
    expect(state.difficulty).toBe('hard');
    assertBoardConsistent(state.player, []);
    assertBoardConsistent(state.ai, []);
  });

  it('refuses an illegal layout instead of entering game state', () => {
    const board = placeShip(createEmptyBoard(), 'carrier', { r: 0, c: 0 }, 'H', 5);
    expect(() => newGame(11, 'medium', board)).toThrow();
  });

  it('places the player fleet at random when no board is supplied', () => {
    expect(newGame(11).player.ships).toEqual(newGame(11).player.ships);
    expect(newGame(11).player.grid).not.toEqual(manualFleet().grid);
  });
});
