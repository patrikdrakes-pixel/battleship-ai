import { useCallback, useState } from 'react';
import type { Difficulty } from '../engine/types';
import { Board } from './components/Board';
import { DifficultySelect } from './components/DifficultySelect';
import { FleetStatus } from './components/FleetStatus';
import { GameOverOverlay } from './components/GameOverOverlay';
import { Legend } from './components/Legend';
import { NewGameButton } from './components/NewGameButton';
import { StatusBanner } from './components/StatusBanner';
import { useGame } from './hooks/useGame';
import './styles/app.css';

export interface AppProps {
  /** Fixed seed for reproducible games (used by tests and `?seed=`). */
  readonly seed?: number;
  readonly aiDelayMs?: number;
  readonly difficulty?: Difficulty;
}

export function App({ seed, aiDelayMs, difficulty }: AppProps) {
  const { state, fire, restart, selectDifficulty } = useGame({
    seed,
    aiDelayMs,
    difficulty,
  });
  const [reviewing, setReviewing] = useState(false);

  const playAgain = useCallback(() => {
    setReviewing(false);
    restart();
  }, [restart]);

  const changeDifficulty = useCallback(
    (next: Difficulty) => {
      setReviewing(false);
      selectDifficulty(next);
    },
    [selectDifficulty],
  );

  const playerTurn = state.phase === 'playing' && state.turn === 'player';
  const lastPlayerShot = state.playerShots.at(-1)?.coord;
  const lastAiShot = state.aiShots.at(-1)?.coord;

  return (
    <main className="app">
      <header className="app-header">
        <h1>Battleship</h1>
        <div className="app-controls">
          <DifficultySelect value={state.difficulty} onSelect={changeDifficulty} />
          <NewGameButton onClick={playAgain} />
        </div>
      </header>

      <StatusBanner state={state} />

      <Legend />

      <div className="boards">
        <div className="board-column">
          <Board
            title="Enemy waters"
            board={state.ai}
            revealShips={state.phase !== 'playing'}
            interactive
            disabled={!playerTurn}
            lastShot={lastPlayerShot}
            onFire={fire}
          />
          <FleetStatus
            title="Enemy fleet"
            board={state.ai}
            revealDamage={state.phase !== 'playing'}
          />
        </div>
        <div className="board-column">
          <Board
            title="Your fleet"
            board={state.player}
            revealShips
            interactive={false}
            lastShot={lastAiShot}
          />
          <FleetStatus title="Your fleet" board={state.player} revealDamage />
        </div>
      </div>

      {state.phase !== 'playing' && !reviewing && (
        <GameOverOverlay
          state={state}
          onPlayAgain={playAgain}
          onSelectDifficulty={changeDifficulty}
          onDismiss={() => setReviewing(true)}
        />
      )}
    </main>
  );
}
