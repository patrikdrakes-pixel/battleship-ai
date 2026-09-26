import type { GameState } from '../../engine/types';
import { describeShot, statusMessage } from '../labels';

export interface StatusBannerProps {
  readonly state: GameState;
}

export function StatusBanner({ state }: StatusBannerProps) {
  const lastPlayer = describeShot('You', state.playerShots[state.playerShots.length - 1]);
  const lastAi = describeShot('Enemy', state.aiShots[state.aiShots.length - 1]);
  const over = state.phase !== 'playing';

  return (
    <div
      className={over ? 'status status--over' : 'status'}
      role="status"
      aria-live="polite"
    >
      <p className="status-main" data-testid="status">
        {statusMessage(state)}
      </p>
      <p className="status-log" data-testid="shot-log">
        {[lastPlayer, lastAi].filter((line) => line !== null).join(' ')}
      </p>
    </div>
  );
}
