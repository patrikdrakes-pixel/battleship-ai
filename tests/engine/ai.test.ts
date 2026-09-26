import { describe, expect, it } from 'vitest';
import {
  createHuntTargetAi,
  deriveUnresolvedHits,
  planShot,
} from '../../src/engine/ai/huntTarget';
import type { AiView, ObservedShot } from '../../src/engine/ai/types';
import { toObservedShots } from '../../src/engine/ai/types';
import { applyShot, coordKey } from '../../src/engine/board';
import { BOARD_SIZE } from '../../src/engine/constants';
import { mulberry32 } from '../../src/engine/rng';
import type { Board, Coord } from '../../src/engine/types';
import { coord, fixedBoard } from '../helpers/boards';

function view(shots: ObservedShot[]): AiView {
  return { boardSize: BOARD_SIZE, shots };
}

function hit(r: number, c: number): ObservedShot {
  return { coord: coord(r, c), outcome: { kind: 'hit' } };
}

function miss(r: number, c: number): ObservedShot {
  return { coord: coord(r, c), outcome: { kind: 'miss' } };
}

function sunk(r: number, c: number, size: number): ObservedShot {
  return { coord: coord(r, c), outcome: { kind: 'sunk', shipId: 'destroyer', size } };
}

function keys(coords: readonly Coord[]): string[] {
  return coords.map(coordKey).sort();
}

interface GameRun {
  readonly shots: Coord[];
  readonly shotsToClear: number;
}

/** Plays the AI against a board until the whole fleet is sunk. */
function playFullGame(seed: number, board: Board = fixedBoard()): GameRun {
  const ai = createHuntTargetAi(mulberry32(seed));
  let current = board;
  const observed: ObservedShot[] = [];
  const shots: Coord[] = [];
  let shotsToClear = 0;

  for (let turn = 0; turn < BOARD_SIZE * BOARD_SIZE; turn += 1) {
    const target = ai.nextShot(view(observed));
    const { board: next, outcome } = applyShot(current, target);
    if (outcome.kind === 'repeat')
      throw new Error(`AI repeated a shot at ${coordKey(target)}`);
    current = next;
    shots.push(target);
    observed.push(...toObservedShots([{ coord: target, outcome }]));
    shotsToClear = turn + 1;
    if (current.ships.every((ship) => ship.hits === ship.size)) break;
  }
  return { shots, shotsToClear };
}

describe('AI never repeats a shot', () => {
  it('fires 100 distinct cells when forced to clear the board', () => {
    const ai = createHuntTargetAi(mulberry32(1));
    const observed: ObservedShot[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) {
      const next = ai.nextShot(view(observed));
      expect(seen.has(coordKey(next))).toBe(false);
      seen.add(coordKey(next));
      // Alternate hits and misses to exercise both modes while never sinking.
      observed.push(i % 3 === 0 ? hit(next.r, next.c) : miss(next.r, next.c));
    }
    expect(seen.size).toBe(100);
    expect(() => ai.nextShot(view(observed))).toThrow();
  });

  it('never repeats across full games on many seeds', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const { shots } = playFullGame(seed);
      expect(new Set(shots.map(coordKey)).size).toBe(shots.length);
    }
  });
});

describe('hunt mode', () => {
  it('starts in hunt mode on the parity lattice', () => {
    const plan = planShot(view([]));
    expect(plan.mode).toBe('hunt');
    expect(plan.candidates).toHaveLength(50);
    expect(plan.candidates.every(({ r, c }) => (r + c) % 2 === 0)).toBe(true);
  });

  it('falls back to any untried cell once the lattice is exhausted', () => {
    const shots: ObservedShot[] = [];
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        if ((r + c) % 2 === 0) shots.push(miss(r, c));
      }
    }
    const plan = planShot(view(shots));
    expect(plan.mode).toBe('hunt');
    expect(plan.candidates).toHaveLength(50);
    expect(plan.candidates.every(({ r, c }) => (r + c) % 2 === 1)).toBe(true);
  });
});

describe('hunt -> target switch', () => {
  it('targets the four neighbours after a single hit', () => {
    const plan = planShot(view([miss(0, 8), hit(4, 4)]));
    expect(plan.mode).toBe('target');
    expect(keys(plan.candidates)).toEqual(
      keys([coord(3, 4), coord(5, 4), coord(4, 3), coord(4, 5)]),
    );
  });

  it('skips neighbours it has already fired at', () => {
    const plan = planShot(view([hit(4, 4), miss(3, 4), miss(4, 3)]));
    expect(plan.mode).toBe('target');
    expect(keys(plan.candidates)).toEqual(keys([coord(5, 4), coord(4, 5)]));
  });
});

describe('axis locking after multiple hits', () => {
  it('extends only along the horizontal run', () => {
    const plan = planShot(view([hit(4, 4), hit(4, 5)]));
    expect(plan.mode).toBe('target');
    expect(keys(plan.candidates)).toEqual(keys([coord(4, 3), coord(4, 6)]));
  });

  it('extends only along the vertical run', () => {
    const plan = planShot(view([hit(4, 4), hit(5, 4), hit(6, 4)]));
    expect(keys(plan.candidates)).toEqual(keys([coord(3, 4), coord(7, 4)]));
  });

  it('fires at the remaining end when one end is a miss', () => {
    const plan = planShot(view([hit(4, 4), hit(4, 5), miss(4, 6)]));
    expect(keys(plan.candidates)).toEqual(keys([coord(4, 3)]));
  });
});

describe('returning to hunt after a sink', () => {
  it('clears the unresolved hits of the sunk ship', () => {
    const shots = [hit(4, 4), sunk(4, 5, 2)];
    expect(deriveUnresolvedHits(view(shots))).toEqual([]);
    expect(planShot(view(shots)).mode).toBe('hunt');
  });

  it('keeps chasing a second damaged ship after the first sinks', () => {
    const shots = [hit(4, 4), sunk(4, 5, 2), hit(8, 1)];
    expect(deriveUnresolvedHits(view(shots))).toEqual([coord(8, 1)]);
    const plan = planShot(view(shots));
    expect(plan.mode).toBe('target');
    expect(keys(plan.candidates)).toEqual(
      keys([coord(7, 1), coord(9, 1), coord(8, 0), coord(8, 2)]),
    );
  });

  it('retires only the sunk ship when the run resolves to one placement', () => {
    // A vertical 2-ship at (4,4)-(5,4): the run is exactly its length.
    const shots = [hit(4, 4), sunk(5, 4, 2)];
    expect(deriveUnresolvedHits(view(shots))).toEqual([]);
    expect(planShot(view(shots)).mode).toBe('hunt');
  });

  it("never retires a live ship's hit when the run is ambiguous", () => {
    // (4,4) belongs to a neighbour; the sunk 3-ship runs (5,4)-(7,4). Only the
    // cells every placement agrees on may be retired, so (4,4) stays a target.
    const shots = [hit(4, 4), hit(6, 4), hit(7, 4), sunk(5, 4, 3)];
    const unresolved = deriveUnresolvedHits(view(shots));
    expect(keys(unresolved)).toContain(coordKey(coord(4, 4)));
    expect(planShot(view(shots)).mode).toBe('target');
  });

  it('keeps both candidates when a sink shot sits between two hits', () => {
    // The 2-ship sank at (5,4) with hits either side: it is either (4,4)-(5,4)
    // or (5,4)-(6,4), so neither neighbour may be written off.
    const shots = [hit(6, 4), hit(4, 4), sunk(5, 4, 2)];
    expect(keys(deriveUnresolvedHits(view(shots)))).toEqual(
      keys([coord(4, 4), coord(6, 4)]),
    );
    expect(planShot(view(shots)).mode).toBe('target');
  });
});

describe('edges and corners', () => {
  it('never proposes off-board cells from a corner hit', () => {
    const topLeft = planShot(view([hit(0, 0)]));
    expect(keys(topLeft.candidates)).toEqual(keys([coord(0, 1), coord(1, 0)]));

    const bottomRight = planShot(view([hit(9, 9)]));
    expect(keys(bottomRight.candidates)).toEqual(keys([coord(8, 9), coord(9, 8)]));
  });

  it('clamps axis extension at the board edge', () => {
    const plan = planShot(view([hit(9, 8), hit(9, 9)]));
    expect(keys(plan.candidates)).toEqual(keys([coord(9, 7)]));
  });

  it('sinks the corner ship of a real board', () => {
    const { shots } = playFullGame(4);
    expect(new Set(shots.map(coordKey)).size).toBe(shots.length);
  });

  it('every proposed shot is in bounds across a full game', () => {
    const { shots } = playFullGame(9);
    expect(
      shots.every(({ r, c }) => r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE),
    ).toBe(true);
  });
});

describe('AI effectiveness', () => {
  it('beats random play: clears the fleet well under 100 shots on average', () => {
    let total = 0;
    const runs = 30;
    for (let seed = 0; seed < runs; seed += 1) {
      total += playFullGame(seed).shotsToClear;
    }
    expect(total / runs).toBeLessThan(75);
  });
});
