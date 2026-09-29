import { useCallback, useEffect, useState } from 'react';
import type { Board as BoardModel, Difficulty } from '../engine/types';
import { Board } from './components/Board';
import { DifficultySelect } from './components/DifficultySelect';
import { FleetStatus } from './components/FleetStatus';
import { GameOverOverlay } from './components/GameOverOverlay';
import { Legend } from './components/Legend';
import { MuteToggle } from './components/MuteToggle';
import { NewGameButton } from './components/NewGameButton';
import { PlacementScreen } from './components/PlacementScreen';
import { StatusBanner } from './components/StatusBanner';
import { useGame } from './hooks/useGame';
import { useMatchRecord } from './hooks/useMatchRecord';
import { useSound } from './hooks/useSound';
import type { SoundPlayer } from './sound';
import { loadPreferences, savePreferences } from './storage';
import './styles/app.css';

export interface AppProps {
  /** Fixed seed for reproducible games (used by tests and `?seed=`). */
  readonly seed?: number;
  readonly aiDelayMs?: number;
  readonly difficulty?: Difficulty;
  /** Injected in tests; the app otherwise synthesises audio itself. */
  readonly soundPlayer?: SoundPlayer;
}

export function App({ seed, aiDelayMs, difficulty, soundPlayer }: AppProps) {
  const [stored] = useState(loadPreferences);
  const { state, fire, restart, startWith, selectDifficulty } = useGame({
    seed,
    aiDelayMs,
    difficulty: difficulty ?? stored.difficulty ?? undefined,
  });
  const [reviewing, setReviewing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [muted, setMuted] = useState(stored.muted);

  useSound(state, muted, soundPlayer);
  const record = useMatchRecord(state);

  useEffect(() => {
    savePreferences({ difficulty: state.difficulty, muted });
  }, [state.difficulty, muted]);

  const playAgain = useCallback(() => {
    setReviewing(false);
    setPlacing(false);
    restart();
  }, [restart]);

  const startPlaced = useCallback(
    (board: BoardModel) => {
      setReviewing(false);
      setPlacing(false);
      startWith(board);
    },
    [startWith],
  );

  const changeDifficulty = useCallback(
    (next: Difficulty) => {
      setReviewing(false);
      setPlacing(false);
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
          <button
            type="button"
            className="button"
            data-testid="place-ships"
            onClick={() => setPlacing(true)}
          >
            Place ships
          </button>
          <MuteToggle muted={muted} onToggle={() => setMuted(!muted)} />
          <NewGameButton onClick={playAgain} />
        </div>
      </header>

      {placing ? (
        <PlacementScreen
          seed={seed}
          onStart={startPlaced}
          onCancel={() => setPlacing(false)}
        />
      ) : (
        <>
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
        </>
      )}

      {state.phase !== 'playing' && !reviewing && !placing && (
        <GameOverOverlay
          state={state}
          record={record}
          onPlayAgain={playAgain}
          onSelectDifficulty={changeDifficulty}
          onDismiss={() => setReviewing(true)}
        />
      )}
    </main>
  );
}
