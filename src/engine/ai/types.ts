import type { Coord, ShipId, Shot } from '../types';

/**
 * What a shooter is actually told after firing. Unlike `ShotOutcome`, a plain
 * hit does not reveal which ship was struck - only a sinking does.
 */
export type ObservedOutcome =
  | { readonly kind: 'miss' }
  | { readonly kind: 'hit' }
  | { readonly kind: 'sunk'; readonly shipId: ShipId; readonly size: number };

export interface ObservedShot {
  readonly coord: Coord;
  readonly outcome: ObservedOutcome;
}

/**
 * Everything the AI is allowed to see: the board size and its own previous
 * shots with their results. It has no access to a `Board`, so it cannot cheat.
 */
export interface AiView {
  readonly boardSize: number;
  readonly shots: readonly ObservedShot[];
}

export interface AiStrategy {
  nextShot(view: AiView): Coord;
}

/** Strips information the shooter is not entitled to. */
export function toObservedShots(shots: readonly Shot[]): ObservedShot[] {
  const observed: ObservedShot[] = [];
  for (const shot of shots) {
    switch (shot.outcome.kind) {
      case 'miss':
        observed.push({ coord: shot.coord, outcome: { kind: 'miss' } });
        break;
      case 'hit':
        observed.push({ coord: shot.coord, outcome: { kind: 'hit' } });
        break;
      case 'sunk':
        observed.push({
          coord: shot.coord,
          outcome: { kind: 'sunk', shipId: shot.outcome.shipId, size: shot.outcome.size },
        });
        break;
      case 'repeat':
        break;
    }
  }
  return observed;
}
