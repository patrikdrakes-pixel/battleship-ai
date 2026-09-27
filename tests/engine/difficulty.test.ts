import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, createAi } from '../../src/engine/ai';
import { planShot } from '../../src/engine/ai/huntTarget';
import {
  createProbabilityAi,
  densityScores,
  remainingSizes,
} from '../../src/engine/ai/probability';
import { createRandomAi, untriedCells } from '../../src/engine/ai/random';
import type { AiStrategy, AiView, ObservedShot } from '../../src/engine/ai/types';
import { toObservedShots } from '../../src/engine/ai/types';
import { applyShot, coordKey } from '../../src/engine/board';
import { BOARD_SIZE } from '../../src/engine/constants';
import { randomPlacement } from '../../src/engine/placement';
import { mulberry32 } from '../../src/engine/rng';
import type { Board, Coord, Difficulty } from '../../src/engine/types';
import { coord } from '../helpers/boards';

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

/** Plays a strategy against one fleet and reports how long it took to clear. */
function shotsToClear(strategy: AiStrategy, start: Board): number {
  let board = start;
  const observed: ObservedShot[] = [];
  for (let turn = 0; turn < BOARD_SIZE * BOARD_SIZE; turn += 1) {
    const target = strategy.nextShot(view(observed));
    const { board: next, outcome } = applyShot(board, target);
    if (outcome.kind === 'repeat')
      throw new Error(`strategy repeated a shot at ${coordKey(target)}`);
    board = next;
    observed.push(...toObservedShots([{ coord: target, outcome }]));
    if (board.ships.every((ship) => ship.hits === ship.size)) return turn + 1;
  }
  return BOARD_SIZE * BOARD_SIZE;
}

/** Averaged over randomly placed fleets, so no single layout can skew it. */
function averageShots(difficulty: Difficulty, runs = 60): number {
  let total = 0;
  for (let seed = 0; seed < runs; seed += 1) {
    total += shotsToClear(
      createAi(difficulty, mulberry32(seed)),
      randomPlacement(mulberry32(seed + 1000)),
    );
  }
  return total / runs;
}

describe('easy: random untried shots', () => {
  it('only ever fires at untried cells', () => {
    const ai = createRandomAi(mulberry32(7));
    const observed: ObservedShot[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) {
      const next = ai.nextShot(view(observed));
      expect(seen.has(coordKey(next))).toBe(false);
      seen.add(coordKey(next));
      observed.push(i % 3 === 0 ? hit(next.r, next.c) : miss(next.r, next.c));
    }
    expect(seen.size).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it('throws once the board is full', () => {
    const observed = untriedCells(view([])).map(({ r, c }) => miss(r, c));
    expect(() => createRandomAi(mulberry32(1)).nextShot(view(observed))).toThrow();
  });

  it('ignores hits instead of following them up', () => {
    // The hunt/target AI would chase (4,4); random play spreads out instead.
    const ai = createRandomAi(mulberry32(3));
    const shots = Array.from({ length: 40 }, (_, i) =>
      ai.nextShot(view([hit(4, 4), ...Array.from({ length: i }, () => miss(0, 0))])),
    );
    const adjacent = shots.filter(({ r, c }) => Math.abs(r - 4) + Math.abs(c - 4) === 1);
    expect(adjacent.length).toBeLessThan(shots.length / 2);
  });
});

describe('hard: probability density', () => {
  it('opens in the middle of the board where the fleet fits in most ways', () => {
    const scores = densityScores(view([]));
    const centre = scores[4][4];
    expect(centre).toBeGreaterThan(scores[0][0]);
    expect(centre).toBeGreaterThan(scores[0][4]);
    const opening = createProbabilityAi(mulberry32(1)).nextShot(view([]));
    expect(scores[opening.r][opening.c]).toBe(centre);
  });

  it('gives a known miss and its cell no weight', () => {
    const scores = densityScores(view([miss(4, 4)]));
    expect(scores[4][4]).toBe(0);
    // The neighbours lose every placement that ran through the miss.
    expect(scores[4][5]).toBeLessThan(densityScores(view([]))[4][5]);
  });

  it('extends a damaged ship along its axis before anything else', () => {
    const shot = createProbabilityAi(mulberry32(2)).nextShot(
      view([hit(4, 4), hit(4, 5)]),
    );
    expect([coordKey(coord(4, 3)), coordKey(coord(4, 6))]).toContain(coordKey(shot));
  });

  it('fires next to a lone hit', () => {
    const shot = createProbabilityAi(mulberry32(5)).nextShot(view([hit(4, 4)]));
    expect(Math.abs(shot.r - 4) + Math.abs(shot.c - 4)).toBe(1);
  });

  it('drops a sunk ship from the remaining fleet', () => {
    const shots = [hit(4, 4), sunk(4, 5, 2)];
    expect(remainingSizes(view(shots))).toEqual([5, 4, 3, 3]);
    // Its cells are now known water-logged wreck and block placements.
    expect(densityScores(view(shots))[4][4]).toBe(0);
  });

  it('stays in bounds and never repeats from a corner hit', () => {
    const ai = createProbabilityAi(mulberry32(11));
    const observed: ObservedShot[] = [hit(0, 0)];
    const seen = new Set([coordKey(coord(0, 0))]);
    for (let i = 0; i < 20; i += 1) {
      const next: Coord = ai.nextShot(view(observed));
      expect(next.r).toBeGreaterThanOrEqual(0);
      expect(next.c).toBeGreaterThanOrEqual(0);
      expect(next.r).toBeLessThan(BOARD_SIZE);
      expect(next.c).toBeLessThan(BOARD_SIZE);
      expect(seen.has(coordKey(next))).toBe(false);
      seen.add(coordKey(next));
      observed.push(miss(next.r, next.c));
    }
  });

  it('falls back to untried cells when no placement is left', () => {
    // Every cell except (9,9) is a miss, so nothing can be placed anywhere.
    const observed = untriedCells(view([]))
      .filter((cell) => coordKey(cell) !== coordKey(coord(9, 9)))
      .map(({ r, c }) => miss(r, c));
    expect(createProbabilityAi(mulberry32(1)).nextShot(view(observed))).toEqual(
      coord(9, 9),
    );
  });
});

describe('difficulty factory', () => {
  it('exposes exactly easy, medium and hard', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
  });

  it('maps medium to the unchanged hunt/target strategy', () => {
    const shots = [hit(4, 4), hit(4, 5)];
    const chosen = createAi('medium', mulberry32(4)).nextShot(view(shots));
    expect(planShot(view(shots)).candidates.map(coordKey)).toContain(coordKey(chosen));
  });

  it('maps easy and hard to different behaviour on the same view', () => {
    const shots = [hit(4, 4), hit(4, 5)];
    const hard = createAi('hard', mulberry32(4)).nextShot(view(shots));
    expect([coordKey(coord(4, 3)), coordKey(coord(4, 6))]).toContain(coordKey(hard));
    // Easy has no reason to be next to the run and, on this seed, is not.
    const easy = createAi('easy', mulberry32(4)).nextShot(view(shots));
    expect(coordKey(easy)).not.toBe(coordKey(hard));
  });
});

describe('relative strength', () => {
  it('ranks hard better than medium, and medium better than easy', () => {
    const easy = averageShots('easy');
    const medium = averageShots('medium');
    const hard = averageShots('hard');
    expect(medium).toBeLessThan(easy);
    expect(hard).toBeLessThan(medium);
  });
});
