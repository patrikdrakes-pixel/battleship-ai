import { coordKey, shipCells } from '../../engine/board';
import type { Board as BoardModel, Coord, Orientation } from '../../engine/types';
import { COLUMN_LABELS, cellLabel } from '../labels';
import { ShipLayer } from './ShipLayer';

export interface PlacementBoardProps {
  readonly board: BoardModel;
  /** Length of the ship being placed; 0 once the fleet is complete. */
  readonly size: number;
  readonly orientation: Orientation;
  readonly hover: Coord | null;
  readonly onHover: (coord: Coord | null) => void;
  readonly onSelect: (coord: Coord) => void;
}

/**
 * The placement grid. It mirrors the playing board's geometry but its cells
 * select an origin instead of firing, and a hovered or focused cell previews
 * where the current ship would land.
 */
export function PlacementBoard({
  board,
  size,
  orientation,
  hover,
  onHover,
  onSelect,
}: PlacementBoardProps) {
  const previewCells =
    hover === null || size === 0 ? [] : shipCells({ origin: hover, orientation, size });
  const legal = previewCells.every(
    (cell) =>
      cell.r < board.grid.length &&
      cell.c < board.grid.length &&
      board.shipAt[cell.r][cell.c] === null,
  );
  const preview = new Map(
    previewCells.map((cell) => [coordKey(cell), legal ? 'legal' : 'illegal'] as const),
  );

  return (
    <div className="board" data-testid="placement-board">
      <div className="board-row" aria-hidden="true">
        <div className="board-label" />
        {COLUMN_LABELS.map((label) => (
          <div key={label} className="board-label">
            {label}
          </div>
        ))}
      </div>
      <div className="board-grid">
        <ShipLayer ships={board.ships} />
        {board.grid.map((row, r) => (
          <div key={r} className="board-row">
            <div className="board-label" aria-hidden="true">
              {r + 1}
            </div>
            {row.map((state, c) => {
              const coord = { r, c };
              const previewState = preview.get(coordKey(coord));
              const occupied = state === 'ship';
              return (
                <button
                  key={c}
                  type="button"
                  className={`cell cell--${occupied ? 'ship' : 'empty'}${
                    previewState === undefined ? '' : ` cell--preview-${previewState}`
                  }`}
                  data-cell={cellLabel(coord)}
                  data-state={occupied ? 'ship' : 'empty'}
                  data-preview={previewState ?? 'none'}
                  aria-label={`${cellLabel(coord)} ${occupied ? 'occupied' : 'free'}`}
                  disabled={size === 0}
                  onMouseEnter={() => onHover(coord)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(coord)}
                  onBlur={() => onHover(null)}
                  onClick={() => onSelect(coord)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
