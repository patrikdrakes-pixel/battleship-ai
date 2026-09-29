import { useCallback, useState } from 'react';
import { canPlace, createEmptyBoard, placeShip } from '../../engine/board';
import { isFleetComplete, randomPlacement, remainingFleet } from '../../engine/placement';
import { mulberry32, randomSeed } from '../../engine/rng';
import type { Board, Coord, Orientation } from '../../engine/types';
import { PlacementBoard } from './PlacementBoard';

export interface PlacementScreenProps {
  readonly onStart: (board: Board) => void;
  readonly onCancel: () => void;
  /** Fixed seed for the Random fleet button; tests pass one for determinism. */
  readonly seed?: number;
}

/**
 * Manual fleet placement. All legality comes from the engine (`canPlace`,
 * `placeShip`), so this component only tracks the work-in-progress board, the
 * orientation and the previewed origin.
 */
export function PlacementScreen({ onStart, onCancel, seed }: PlacementScreenProps) {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [orientation, setOrientation] = useState<Orientation>('H');
  const [hover, setHover] = useState<Coord | null>(null);

  const pending = remainingFleet(board);
  const next = pending[0];
  const complete = isFleetComplete(board);

  const rotate = useCallback(() => {
    setOrientation((current) => (current === 'H' ? 'V' : 'H'));
  }, []);

  function select(origin: Coord): void {
    if (next === undefined) return;
    if (!canPlace(board, origin, orientation, next.size)) return;
    setBoard(placeShip(board, next.id, origin, orientation, next.size));
  }

  const randomize = useCallback(() => {
    setBoard(randomPlacement(mulberry32(seed ?? randomSeed())));
    setHover(null);
  }, [seed]);

  const clear = useCallback(() => {
    setBoard(createEmptyBoard());
    setHover(null);
  }, []);

  return (
    <section
      className="placement"
      aria-labelledby="placement-title"
      data-testid="placement"
      onKeyDown={(event) => {
        if (event.key === 'r' || event.key === 'R') rotate();
      }}
    >
      <h2 id="placement-title">Place your fleet</h2>
      <p className="placement-hint">
        Pick the bow cell for each ship. Press <kbd>R</kbd> or use Rotate to switch
        between horizontal and vertical.
      </p>

      <p className="placement-current" aria-live="polite" data-testid="placement-current">
        {complete
          ? 'Fleet complete — start the battle.'
          : `Placing ${next?.name ?? ''} (${next?.size ?? 0} cells, ${
              orientation === 'H' ? 'horizontal' : 'vertical'
            })`}
      </p>

      <div className="placement-body">
        <PlacementBoard
          board={board}
          size={next?.size ?? 0}
          orientation={orientation}
          hover={hover}
          onHover={setHover}
          onSelect={select}
        />
        <ul className="placement-fleet" data-testid="placement-fleet">
          {pending.map((entry) => (
            <li key={entry.id}>{`${entry.name} (${entry.size})`}</li>
          ))}
        </ul>
      </div>

      <div className="placement-actions">
        <button type="button" className="button" onClick={rotate}>
          Rotate
        </button>
        <button type="button" className="button" onClick={randomize}>
          Random fleet
        </button>
        <button type="button" className="button" onClick={clear}>
          Clear
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!complete}
          onClick={() => onStart(board)}
        >
          Start battle
        </button>
      </div>
    </section>
  );
}
