import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../engine/types';
import { loadRecord, recordResult, type MatchRecord } from '../storage';

/**
 * Counts each finished game once. A game keeps its state object after the final
 * shot, so that object identity is what tells a re-render from a new result.
 */
export function useMatchRecord(state: GameState): MatchRecord {
  const [record, setRecord] = useState<MatchRecord>(loadRecord);
  const counted = useRef<GameState | null>(null);

  useEffect(() => {
    if (state.phase === 'playing') {
      counted.current = null;
      return;
    }
    if (counted.current === state) return;
    counted.current = state;

    setRecord(recordResult(state.phase === 'playerWon' ? 'win' : 'loss'));
  }, [state]);

  return record;
}
