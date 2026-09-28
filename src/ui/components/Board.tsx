import { coordKey, isSunk, shipCells } from '../../engine/board';
import { BOARD_SIZE } from '../../engine/constants';
import type { Board as BoardModel, Coord } from '../../engine/types';
import { COLUMN_LABELS } from '../labels';
import { Cell } from './Cell';
import { ShipLayer } from './ShipLayer';

export interface BoardProps {
  readonly title: string;
  readonly board: BoardModel;
  readonly revealShips: boolean;
  readonly interactive: boolean;
  readonly disabled?: boolean;
  /** Cell of the most recent shot fired at this board, highlighted for context. */
  readonly lastShot?: Coord;
  readonly onFire?: (coord: Coord) => void;
}

export function Board({
  title,
  board,
  revealShips,
  interactive,
  disabled,
  lastShot,
  onFire,
}: BoardProps) {
  const sunkCells = new Set(board.ships.filter(isSunk).flatMap(shipCells).map(coordKey));
  const lastKey = lastShot === undefined ? null : coordKey(lastShot);
  // Enemy hulls stay hidden until they sink; a finished game reveals the rest.
  const visibleShips = board.ships.filter((ship) => revealShips || isSunk(ship));

  return (
    <section className="board-panel" aria-label={title}>
      <h2 className="board-title">{title}</h2>
      <div className="board" data-testid={interactive ? 'enemy-board' : 'player-board'}>
        <div className="board-row" aria-hidden="true">
          <div className="board-label" />
          {COLUMN_LABELS.map((label) => (
            <div key={label} className="board-label">
              {label}
            </div>
          ))}
        </div>
        <div className="board-grid">
          <ShipLayer ships={visibleShips} />
          {/* Rows carry no grid ARIA: without roving-tabindex grid navigation
              it would only break the required grid > row > gridcell structure.
              Each cell announces its own coordinate instead. */}
          {board.grid.map((row, r) => (
            <div key={r} className="board-row">
              <div className="board-label" aria-hidden="true">
                {r + 1}
              </div>
              {row.map((state, c) => (
                <Cell
                  key={c}
                  coord={{ r, c }}
                  state={state}
                  revealShips={revealShips}
                  interactive={interactive}
                  sunk={sunkCells.has(coordKey({ r, c }))}
                  last={lastKey === coordKey({ r, c })}
                  disabled={disabled}
                  onFire={onFire}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="board-hint">{`${BOARD_SIZE} x ${BOARD_SIZE}`}</p>
    </section>
  );
}
