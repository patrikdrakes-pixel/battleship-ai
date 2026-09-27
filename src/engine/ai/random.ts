import { coordKey } from '../board';
import type { Rng } from '../rng';
import type { Coord } from '../types';
import type { AiStrategy, AiView } from './types';

/** Every untried cell on the board, in row-major order. */
export function untriedCells(view: AiView): Coord[] {
  const taken = new Set(view.shots.map((shot) => coordKey(shot.coord)));
  const cells: Coord[] = [];
  for (let r = 0; r < view.boardSize; r += 1) {
    for (let c = 0; c < view.boardSize; c += 1) {
      if (!taken.has(coordKey({ r, c }))) cells.push({ r, c });
    }
  }
  return cells;
}

/** Easy: uniform random fire, ignoring its own results. Never repeats a shot. */
export function createRandomAi(rng: Rng): AiStrategy {
  return {
    nextShot(view: AiView): Coord {
      const cells = untriedCells(view);
      if (cells.length === 0) throw new Error('No legal cells left to fire at');
      return cells[rng.nextInt(cells.length)];
    },
  };
}
