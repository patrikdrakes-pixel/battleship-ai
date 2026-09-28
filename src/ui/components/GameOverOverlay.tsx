import { useEffect, useRef } from 'react';
import { DIFFICULTIES } from '../../engine/ai';
import type { Difficulty, GameState } from '../../engine/types';
import { DIFFICULTY_LABELS } from '../labels';
import { gameSummary } from '../stats';

export interface GameOverOverlayProps {
  readonly state: GameState;
  readonly onPlayAgain: () => void;
  readonly onSelectDifficulty: (difficulty: Difficulty) => void;
  readonly onDismiss: () => void;
}

export function GameOverOverlay({
  state,
  onPlayAgain,
  onSelectDifficulty,
  onDismiss,
}: GameOverOverlayProps) {
  const playAgain = useRef<HTMLButtonElement>(null);
  const won = state.phase === 'playerWon';
  const { shots, hits, accuracy, shipsSunk, shipsLost } = gameSummary(state);

  useEffect(() => {
    playAgain.current?.focus();
  }, []);

  return (
    <div className="overlay" data-testid="game-over">
      <div
        className="overlay-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
      >
        <h2 className="overlay-title" id="game-over-title">
          {won ? 'Victory' : 'Defeat'}
        </h2>
        <p className="overlay-subtitle">
          {won
            ? 'The enemy fleet is on the bottom of the sea.'
            : 'Your fleet has been destroyed.'}
        </p>

        <dl className="overlay-stats">
          <div>
            <dt>Shots fired</dt>
            <dd data-testid="stat-shots">{shots}</dd>
          </div>
          <div>
            <dt>Hits</dt>
            <dd data-testid="stat-hits">{hits}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd data-testid="stat-accuracy">{`${accuracy}%`}</dd>
          </div>
          <div>
            <dt>Enemy ships sunk</dt>
            <dd data-testid="stat-sunk">{`${shipsSunk}/5`}</dd>
          </div>
          <div>
            <dt>Ships lost</dt>
            <dd data-testid="stat-lost">{`${shipsLost}/5`}</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd data-testid="stat-difficulty">{DIFFICULTY_LABELS[state.difficulty]}</dd>
          </div>
        </dl>

        <div className="overlay-actions">
          <button
            type="button"
            className="button button--primary"
            ref={playAgain}
            onClick={() => onPlayAgain()}
          >
            Play again
          </button>
          <button type="button" className="button" onClick={() => onDismiss()}>
            Review the boards
          </button>
        </div>

        <p className="overlay-hint">Or start again on a different difficulty:</p>
        <div className="overlay-difficulties">
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              className="button button--ghost"
              aria-pressed={difficulty === state.difficulty}
              onClick={() => onSelectDifficulty(difficulty)}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
