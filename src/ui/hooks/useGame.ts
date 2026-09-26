import { useCallback, useEffect, useReducer } from 'react';
import { DEFAULT_DIFFICULTY, gameReducer, newGame } from '../../engine/game';
import type { Coord, Difficulty, GameState } from '../../engine/types';

export const DEFAULT_AI_DELAY_MS = 450;

export interface UseGameOptions {
  readonly seed?: number;
  /** Purely cosmetic pause before the AI replies; 0 in tests. */
  readonly aiDelayMs?: number;
  readonly difficulty?: Difficulty;
}

export interface UseGameResult {
  readonly state: GameState;
  readonly fire: (coord: Coord) => void;
  readonly restart: () => void;
  /** Picking a difficulty starts a fresh game at that setting. */
  readonly selectDifficulty: (difficulty: Difficulty) => void;
}

export function useGame({
  seed,
  aiDelayMs = DEFAULT_AI_DELAY_MS,
  difficulty = DEFAULT_DIFFICULTY,
}: UseGameOptions = {}): UseGameResult {
  const [state, dispatch] = useReducer(gameReducer, { seed, difficulty }, (init) =>
    newGame(init.seed, init.difficulty),
  );

  useEffect(() => {
    if (state.phase !== 'playing' || state.turn !== 'ai') return;
    const timer = setTimeout(() => dispatch({ type: 'AI_TURN' }), aiDelayMs);
    return () => clearTimeout(timer);
  }, [state.phase, state.turn, state.aiShots.length, aiDelayMs]);

  const fire = useCallback((coord: Coord) => dispatch({ type: 'FIRE', coord }), []);
  const restart = useCallback(() => dispatch({ type: 'NEW_GAME' }), []);
  const selectDifficulty = useCallback(
    (next: Difficulty) => dispatch({ type: 'NEW_GAME', difficulty: next }),
    [],
  );

  return { state, fire, restart, selectDifficulty };
}
