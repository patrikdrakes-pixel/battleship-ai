import { Board } from './components/Board';
import { FleetStatus } from './components/FleetStatus';
import { NewGameButton } from './components/NewGameButton';
import { StatusBanner } from './components/StatusBanner';
import { useGame } from './hooks/useGame';
import './styles/app.css';

export interface AppProps {
  /** Fixed seed for reproducible games (used by tests and `?seed=`). */
  readonly seed?: number;
  readonly aiDelayMs?: number;
}

export function App({ seed, aiDelayMs }: AppProps) {
  const { state, fire, restart } = useGame({ seed, aiDelayMs });
  const playerTurn = state.phase === 'playing' && state.turn === 'player';

  return (
    <main className="app">
      <header className="app-header">
        <h1>Battleship</h1>
        <NewGameButton onClick={restart} />
      </header>

      <StatusBanner state={state} />

      <div className="boards">
        <div className="board-column">
          <Board
            title="Enemy waters"
            board={state.ai}
            revealShips={state.phase !== 'playing'}
            interactive
            disabled={!playerTurn}
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
          />
          <FleetStatus title="Your fleet" board={state.player} revealDamage />
        </div>
      </div>
    </main>
  );
}
