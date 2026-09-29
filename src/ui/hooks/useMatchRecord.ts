import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../engine/types';
import { loadRecord, saveRecord, type MatchRecord } from '../storage';

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

    setRecord((previous) =>
      state.phase === 'playerWon'
        ? { wins: previous.wins + 1, losses: previous.losses }
        : { wins: previous.wins, losses: previous.losses + 1 },
    );
  }, [state]);

  useEffect(() => {
    saveRecord(record);
  }, [record]);

  return record;
}
