import { coordKey } from '../board';
import type { Rng } from '../rng';
import type { Coord } from '../types';
import type { AiStrategy, AiView } from './types';

export type AiMode = 'hunt' | 'target';

export interface AiPlan {
  readonly mode: AiMode;
  /** Untargeted, in-bounds cells the AI considers equally good this turn. */
  readonly candidates: readonly Coord[];
  /** Hits belonging to a damaged but not yet sunk ship. */
  readonly unresolvedHits: readonly Coord[];
}

const DIRECTIONS: readonly Coord[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

/**
 * Hits that belong to ships still afloat, derived purely by replaying the
 * observed shot history. When a ship sinks, the run of hits that made it up is
 * retired so the AI does not keep chasing a dead ship.
 */
export function deriveUnresolvedHits(view: AiView): Coord[] {
  let active: Coord[] = [];
  for (const shot of view.shots) {
    if (shot.outcome.kind === 'hit') {
      active.push(shot.coord);
    } else if (shot.outcome.kind === 'sunk') {
      active.push(shot.coord);
      active = retireSunkShip(active, shot.coord, shot.outcome.size);
    }
  }
  return active;
}

function retireSunkShip(active: readonly Coord[], sinkAt: Coord, size: number): Coord[] {
  const present = new Set(active.map(coordKey));
  const axes: readonly (readonly [Coord, Coord])[] = [
    [
      { r: 0, c: -1 },
      { r: 0, c: 1 },
    ],
    [
      { r: -1, c: 0 },
      { r: 1, c: 0 },
    ],
  ];

  const runs = axes.map(([back, forward]) => [
    ...walk(present, sinkAt, back).reverse(),
    sinkAt,
    ...walk(present, sinkAt, forward),
  ]);

  // Every run at least `size` long could hold the sunk ship, and a run longer
  // than it mixes in a neighbouring ship's hits. The observed history cannot
  // say which axis or where the boundary is, so retire only the cells all of
  // the candidate placements agree on and leave a surviving ship targetable.
  const candidates = runs
    .filter((run) => run.length >= size)
    .map((run) => ambiguousCore(run, sinkAt, size));
  const best = candidates.length === 0 ? [sinkAt] : intersect(candidates);

  const retired = new Set(best.map(coordKey));
  return active.filter((coord) => !retired.has(coordKey(coord)));
}

function intersect(groups: readonly (readonly Coord[])[]): readonly Coord[] {
  return groups.reduce((a, b) => {
    const keep = new Set(b.map(coordKey));
    return a.filter((coord) => keep.has(coordKey(coord)));
  });
}

/** Cells shared by every length-`size` window of `run` that covers `sinkAt`. */
function ambiguousCore(run: readonly Coord[], sinkAt: Coord, size: number): Coord[] {
  const index = run.findIndex((coord) => coordKey(coord) === coordKey(sinkAt));
  const first = Math.max(0, index - size + 1);
  const last = Math.min(index, run.length - size);
  return run.slice(last, first + size);
}

function walk(present: ReadonlySet<string>, from: Coord, step: Coord): Coord[] {
  const cells: Coord[] = [];
  let cursor = { r: from.r + step.r, c: from.c + step.c };
  while (present.has(coordKey(cursor))) {
    cells.push(cursor);
    cursor = { r: cursor.r + step.r, c: cursor.c + step.c };
  }
  return cells;
}

function connectedClusters(hits: readonly Coord[]): Coord[][] {
  const remaining = new Map(hits.map((coord) => [coordKey(coord), coord]));
  const clusters: Coord[][] = [];
  while (remaining.size > 0) {
    const [firstKey, firstCoord] = [...remaining][0];
    remaining.delete(firstKey);
    const cluster = [firstCoord];
    const queue = [firstCoord];
    while (queue.length > 0) {
      const current = queue.pop() as Coord;
      for (const dir of DIRECTIONS) {
        const key = coordKey({ r: current.r + dir.r, c: current.c + dir.c });
        const neighbour = remaining.get(key);
        if (neighbour !== undefined) {
          remaining.delete(key);
          cluster.push(neighbour);
          queue.push(neighbour);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function isCollinear(cluster: readonly Coord[]): boolean {
  return (
    cluster.every((cell) => cell.r === cluster[0].r) ||
    cluster.every((cell) => cell.c === cluster[0].c)
  );
}

/** For a locked-in axis, the two cells just beyond each end of the run. */
function axisEnds(cluster: readonly Coord[]): Coord[] {
  const horizontal = cluster.every((cell) => cell.r === cluster[0].r);
  const sorted = [...cluster].sort((a, b) => (horizontal ? a.c - b.c : a.r - b.r));
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  return horizontal
    ? [
        { r: low.r, c: low.c - 1 },
        { r: high.r, c: high.c + 1 },
      ]
    : [
        { r: low.r - 1, c: low.c },
        { r: high.r + 1, c: high.c },
      ];
}

function neighbours(cluster: readonly Coord[]): Coord[] {
  const out: Coord[] = [];
  for (const cell of cluster) {
    for (const dir of DIRECTIONS) {
      out.push({ r: cell.r + dir.r, c: cell.c + dir.c });
    }
  }
  return out;
}

/**
 * Decides what the AI would consider this turn. Exposed separately from
 * `nextShot` so tests can assert the mode and candidate set without RNG.
 */
export function planShot(view: AiView): AiPlan {
  const size = view.boardSize;
  const taken = new Set(view.shots.map((shot) => coordKey(shot.coord)));
  const legal = (coord: Coord): boolean =>
    coord.r >= 0 &&
    coord.r < size &&
    coord.c >= 0 &&
    coord.c < size &&
    !taken.has(coordKey(coord));

  const unresolvedHits = deriveUnresolvedHits(view);

  if (unresolvedHits.length > 0) {
    const clusters = connectedClusters(unresolvedHits).sort(
      (a, b) => b.length - a.length,
    );
    for (const cluster of clusters) {
      const preferred =
        cluster.length >= 2 && isCollinear(cluster)
          ? axisEnds(cluster)
          : neighbours(cluster);
      const candidates = dedupe(preferred.filter(legal));
      if (candidates.length > 0) return { mode: 'target', candidates, unresolvedHits };
      // A collinear run boxed in at both ends: widen to every neighbour.
      const fallback = dedupe(neighbours(cluster).filter(legal));
      if (fallback.length > 0)
        return { mode: 'target', candidates: fallback, unresolvedHits };
    }
  }

  const untried: Coord[] = [];
  const parity: Coord[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const coord = { r, c };
      if (!legal(coord)) continue;
      untried.push(coord);
      // Every ship is at least 2 long, so it must touch this lattice.
      if ((r + c) % 2 === 0) parity.push(coord);
    }
  }
  return {
    mode: 'hunt',
    candidates: parity.length > 0 ? parity : untried,
    unresolvedHits,
  };
}

function dedupe(coords: readonly Coord[]): Coord[] {
  const seen = new Set<string>();
  const out: Coord[] = [];
  for (const coord of coords) {
    const key = coordKey(coord);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(coord);
    }
  }
  return out;
}

export function createHuntTargetAi(rng: Rng): AiStrategy {
  return {
    nextShot(view: AiView): Coord {
      const plan = planShot(view);
      if (plan.candidates.length === 0) {
        throw new Error('No legal cells left to fire at');
      }
      return plan.candidates[rng.nextInt(plan.candidates.length)];
    },
  };
}
