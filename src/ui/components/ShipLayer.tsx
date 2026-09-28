import { isSunk } from '../../engine/board';
import type { Ship } from '../../engine/types';
import { ShipSvg } from './ShipSvg';

export interface ShipLayerProps {
  readonly ships: readonly Ship[];
}

/**
 * Hull silhouettes drawn under the cells, on a grid aligned with them. Purely
 * decorative: cells keep every shot state, label and interaction.
 */
export function ShipLayer({ ships }: ShipLayerProps) {
  return (
    <div className="ship-layer" aria-hidden="true" data-testid="ship-layer">
      {ships.map((ship) => {
        const span = ship.orientation === 'H' ? 'column' : 'row';
        return (
          <div
            key={ship.id}
            className="ship-slot"
            data-ship={ship.id}
            style={{
              gridColumn: `${ship.origin.c + 1}${span === 'column' ? ` / span ${ship.size}` : ''}`,
              gridRow: `${ship.origin.r + 1}${span === 'row' ? ` / span ${ship.size}` : ''}`,
            }}
          >
            <ShipSvg ship={ship} sunk={isSunk(ship)} />
          </div>
        );
      })}
    </div>
  );
}
