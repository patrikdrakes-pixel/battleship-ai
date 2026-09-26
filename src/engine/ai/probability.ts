import { coordKey } from '../board';
import { FLEET } from '../constants';
import type { Rng } from '../rng';
import type { Coord, ShipId } from '../types';
import { deriveUnresolvedHits } from './huntTarget';
import { untriedCells } from './random';
import type { AiStrategy, AiView } from './types';

/**
 * How much more a placement counts for every unresolved hit it explains. Large
 * enough that finishing a damaged ship always outranks fresh exploration.
 */
const HIT_WEIGHT = 32;

/** Ships the shooter has not yet sunk, derived from the sink reports. */
export function remainingSizes(view: AiView): number[] {
  const sunk = new Set<ShipId>();
  for (const shot of view.shots) {
    if (shot.outcome.kind === 'sunk') sunk.add(shot.outcome.shipId);
  }
  return FLEET.filter((entry) => !sunk.has(entry.id)).map((entry) => entry.size);
}

/**
 * For every cell, how many legal placements of the remaining fleet would cover
 * it. Cells known to be water or to belong to a sunk ship block a placement;
 * while a damaged ship is unaccounted for, only placements that explain one of
 * its hits are counted, which subsumes hunt/target.
 */
export function densityScores(view: AiView): number[][] {
  const size = view.boardSize;
  const taken = new Set(view.shots.map((shot) => coordKey(shot.coord)));
  const unresolved = new Set(deriveUnresolvedHits(view).map(coordKey));
  const blocked = new Set<string>();
  for (const shot of view.shots) {
    const key = coordKey(shot.coord);
    if (shot.outcome.kind === 'miss' || !unresolved.has(key)) blocked.add(key);
  }

  const scores = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const orientations: readonly Coord[] = [
    { r: 0, c: 1 },
    { r: 1, c: 0 },
  ];

  for (const shipSize of remainingSizes(view)) {
    for (const step of orientations) {
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          const cells: Coord[] = [];
          for (let i = 0; i < shipSize; i += 1) {
            cells.push({ r: r + step.r * i, c: c + step.c * i });
          }
          const last = cells[cells.length - 1];
          if (last.r >= size || last.c >= size) continue;
          if (cells.some((cell) => blocked.has(coordKey(cell)))) continue;

          const covered = cells.filter((cell) => unresolved.has(coordKey(cell))).length;
          if (unresolved.size > 0 && covered === 0) continue;

          const weight = HIT_WEIGHT ** covered;
          for (const cell of cells) {
            if (!taken.has(coordKey(cell))) scores[cell.r][cell.c] += weight;
          }
        }
      }
    }
  }
  return scores;
}

/** Untried cells sharing the highest density score. */
export function densityPeaks(view: AiView): Coord[] {
  const scores = densityScores(view);
  let best = 0;
  let peaks: Coord[] = [];
  for (const cell of untriedCells(view)) {
    const score = scores[cell.r][cell.c];
    if (score > best) {
      best = score;
      peaks = [cell];
    } else if (score === best && score > 0) {
      peaks.push(cell);
    }
  }
  return peaks;
}

/**
 * Hard: fires where the remaining fleet can fit in the most ways. Falls back to
 * any untried cell if no placement is left to reason about.
 */
export function createProbabilityAi(rng: Rng): AiStrategy {
  return {
    nextShot(view: AiView): Coord {
      const candidates = densityPeaks(view);
      const cells = candidates.length > 0 ? candidates : untriedCells(view);
      if (cells.length === 0) throw new Error('No legal cells left to fire at');
      return cells[rng.nextInt(cells.length)];
    },
  };
}
