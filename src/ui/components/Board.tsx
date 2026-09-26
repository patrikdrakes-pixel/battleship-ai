import { coordKey, isSunk, shipCells } from '../../engine/board';
import { BOARD_SIZE } from '../../engine/constants';
import type { Board as BoardModel, Coord } from '../../engine/types';
import { COLUMN_LABELS } from '../labels';
import { Cell } from './Cell';

export interface BoardProps {
  readonly title: string;
  readonly board: BoardModel;
  readonly revealShips: boolean;
  readonly interactive: boolean;
  readonly disabled?: boolean;
  readonly onFire?: (coord: Coord) => void;
}

export function Board({
  title,
  board,
  revealShips,
  interactive,
  disabled,
  onFire,
}: BoardProps) {
  const sunkCells = new Set(board.ships.filter(isSunk).flatMap(shipCells).map(coordKey));

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
        {board.grid.map((row, r) => (
          <div key={r} className="board-row" role="row">
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
                disabled={disabled}
                onFire={onFire}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="board-hint">{`${BOARD_SIZE} x ${BOARD_SIZE}`}</p>
    </section>
  );
}
