import { FLEET } from '../../engine/constants';
import type { Board } from '../../engine/types';

export interface FleetStatusProps {
  readonly title: string;
  readonly board: Board;
}

export function FleetStatus({ title, board }: FleetStatusProps) {
  return (
    <div className="fleet" aria-label={title}>
      <h3 className="fleet-title">{title}</h3>
      <ul className="fleet-list">
        {FLEET.map((entry) => {
          const ship = board.ships.find((candidate) => candidate.id === entry.id);
          const hits = ship?.hits ?? 0;
          const sunk = hits >= entry.size;
          return (
            <li
              key={entry.id}
              className={sunk ? 'fleet-item fleet-item--sunk' : 'fleet-item'}
            >
              <span className="fleet-name">{entry.name}</span>
              <span className="fleet-pips" aria-hidden="true">
                {'#'.repeat(entry.size - hits) + 'x'.repeat(hits)}
              </span>
              <span className="fleet-state">
                {sunk ? 'SUNK' : `${hits}/${entry.size}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
