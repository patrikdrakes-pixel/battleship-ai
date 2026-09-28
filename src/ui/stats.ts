import { isSunk } from '../engine/board';
import type { GameState } from '../engine/types';

export interface GameSummary {
  readonly shots: number;
  readonly hits: number;
  /** Hit rate as a percentage, rounded; 0 when no shot was fired. */
  readonly accuracy: number;
  readonly shipsSunk: number;
  readonly shipsLost: number;
}

export function gameSummary(state: GameState): GameSummary {
  const shots = state.playerShots.length;
  const hits = state.playerShots.filter(
    (shot) => shot.outcome.kind === 'hit' || shot.outcome.kind === 'sunk',
  ).length;

  return {
    shots,
    hits,
    accuracy: shots === 0 ? 0 : Math.round((hits / shots) * 100),
    shipsSunk: state.ai.ships.filter(isSunk).length,
    shipsLost: state.player.ships.filter(isSunk).length,
  };
}
