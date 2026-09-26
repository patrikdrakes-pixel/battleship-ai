import type { CellState, Coord } from '../../engine/types';
import { cellLabel } from '../labels';

export interface CellProps {
  readonly coord: Coord;
  readonly state: CellState;
  /** Own board reveals ships; the enemy board hides untouched ships. */
  readonly revealShips: boolean;
  readonly interactive: boolean;
  /** Part of a ship whose every cell has been hit. */
  readonly sunk?: boolean;
  readonly disabled?: boolean;
  readonly onFire?: (coord: Coord) => void;
}

function visibleState(state: CellState, revealShips: boolean): CellState {
  if (state === 'ship' && !revealShips) return 'empty';
  return state;
}

export function Cell({
  coord,
  state,
  revealShips,
  interactive,
  sunk = false,
  disabled = false,
  onFire,
}: CellProps) {
  const visible = visibleState(state, revealShips);
  const className = `cell cell--${visible}${sunk ? ' cell--sunk' : ''}`;
  const label = `${cellLabel(coord)} ${sunk ? 'sunk' : visible}`;

  if (!interactive) {
    return (
      <div
        className={className}
        role="img"
        aria-label={label}
        data-state={visible}
        data-sunk={sunk}
      />
    );
  }

  const alreadyFired = visible === 'hit' || visible === 'miss';
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      data-state={visible}
      data-sunk={sunk}
      data-cell={cellLabel(coord)}
      data-fired={alreadyFired}
      disabled={disabled || alreadyFired}
      onClick={() => onFire?.(coord)}
    />
  );
}
