import { FLEET } from '../../engine/constants';
import type { Board } from '../../engine/types';

export interface FleetStatusProps {
  readonly title: string;
  readonly board: Board;
  /**
   * Whether partial damage may be shown. Hidden for the enemy fleet during
   * play: a hit count would name the ship a plain hit landed on.
   */
  readonly revealDamage: boolean;
}

export function FleetStatus({ title, board, revealDamage }: FleetStatusProps) {
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
                {revealDamage || sunk
                  ? '#'.repeat(entry.size - hits) + 'x'.repeat(hits)
                  : '#'.repeat(entry.size)}
              </span>
              <span className="fleet-state">
                {sunk ? 'SUNK' : revealDamage ? `${hits}/${entry.size}` : 'AFLOAT'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
