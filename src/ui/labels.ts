import { FLEET } from '../engine/constants';
import type { Coord, GameState, ShipId, Shot } from '../engine/types';

export const COLUMN_LABELS = [...'ABCDEFGHIJ'];

export function cellLabel(coord: Coord): string {
  return `${COLUMN_LABELS[coord.c]}${coord.r + 1}`;
}

export function shipName(id: ShipId): string {
  return FLEET.find((entry) => entry.id === id)?.name ?? id;
}

export function describeShot(who: string, shot: Shot | undefined): string | null {
  if (shot === undefined) return null;
  const where = cellLabel(shot.coord);
  switch (shot.outcome.kind) {
    case 'miss':
      return `${who} fired at ${where}: miss.`;
    case 'hit':
      return `${who} fired at ${where}: hit!`;
    case 'sunk':
      return `${who} fired at ${where}: sunk the ${shipName(shot.outcome.shipId)}!`;
    case 'repeat':
      return null;
  }
}

export function statusMessage(state: GameState): string {
  switch (state.phase) {
    case 'playerWon':
      return 'You win! The enemy fleet is destroyed.';
    case 'aiWon':
      return 'You lose. Your fleet is destroyed.';
    case 'playing':
      return state.turn === 'player'
        ? 'Your turn: fire at the enemy waters.'
        : 'Enemy is firing...';
  }
}
