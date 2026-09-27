import { DIFFICULTIES } from '../../engine/ai';
import type { Difficulty } from '../../engine/types';
import { DIFFICULTY_LABELS } from '../labels';

export interface DifficultySelectProps {
  readonly value: Difficulty;
  readonly onSelect: (difficulty: Difficulty) => void;
}

export function DifficultySelect({ value, onSelect }: DifficultySelectProps) {
  return (
    <div className="difficulty">
      <label className="difficulty-label" htmlFor="difficulty">
        Difficulty
      </label>
      <select
        id="difficulty"
        className="difficulty-select"
        data-testid="difficulty"
        value={value}
        onChange={(event) => onSelect(event.target.value as Difficulty)}
      >
        {DIFFICULTIES.map((difficulty) => (
          <option key={difficulty} value={difficulty}>
            {DIFFICULTY_LABELS[difficulty]}
          </option>
        ))}
      </select>
      <p className="difficulty-hint">Changing difficulty starts a new game.</p>
    </div>
  );
}
