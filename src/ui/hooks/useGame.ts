import { useCallback, useEffect, useReducer } from 'react';
import { gameReducer, newGame } from '../../engine/game';
import type { Coord, GameState } from '../../engine/types';

export const DEFAULT_AI_DELAY_MS = 450;

export interface UseGameOptions {
  readonly seed?: number;
  /** Purely cosmetic pause before the AI replies; 0 in tests. */
  readonly aiDelayMs?: number;
}

export interface UseGameResult {
  readonly state: GameState;
  readonly fire: (coord: Coord) => void;
  readonly restart: () => void;
}

export function useGame({
  seed,
  aiDelayMs = DEFAULT_AI_DELAY_MS,
}: UseGameOptions = {}): UseGameResult {
  const [state, dispatch] = useReducer(gameReducer, seed, (initialSeed) =>
    newGame(initialSeed),
  );

  useEffect(() => {
    if (state.phase !== 'playing' || state.turn !== 'ai') return;
    const timer = setTimeout(() => dispatch({ type: 'AI_TURN' }), aiDelayMs);
    return () => clearTimeout(timer);
  }, [state.phase, state.turn, state.aiShots.length, aiDelayMs]);

  const fire = useCallback((coord: Coord) => dispatch({ type: 'FIRE', coord }), []);
  const restart = useCallback(() => dispatch({ type: 'NEW_GAME' }), []);

  return { state, fire, restart };
}
