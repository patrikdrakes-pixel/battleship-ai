import { useEffect, useRef } from 'react';
import type { GameState, Shot } from '../../engine/types';
import type { SoundName, SoundPlayer } from '../sound';
import { createSoundPlayer } from '../sound';

function outcomeSound(shot: Shot | undefined): SoundName | null {
  switch (shot?.outcome.kind) {
    case 'miss':
      return 'miss';
    case 'hit':
      return 'hit';
    case 'sunk':
      return 'sunk';
    default:
      return null;
  }
}

/**
 * Plays a blip for every new shot and for the result. Sound is decoration: it
 * reacts to state, never drives it, and a muted player simply skips playback.
 */
export function useSound(state: GameState, muted: boolean, player?: SoundPlayer): void {
  const playerRef = useRef<SoundPlayer | null>(null);
  playerRef.current ??= player ?? createSoundPlayer();

  const shotCount = state.playerShots.length + state.aiShots.length;
  const seen = useRef(shotCount);
  const lastPhase = useRef(state.phase);

  useEffect(() => {
    const active = playerRef.current;
    if (active === null) return;

    const fresh = shotCount > seen.current;
    seen.current = shotCount;
    const phaseChanged = state.phase !== lastPhase.current;
    lastPhase.current = state.phase;

    if (muted) return;
    if (phaseChanged && state.phase !== 'playing') {
      active.play(state.phase === 'playerWon' ? 'win' : 'loss');
      return;
    }
    if (!fresh) return;
    const newest =
      state.turn === 'player' ? state.aiShots.at(-1) : state.playerShots.at(-1);
    const sound = outcomeSound(newest);
    if (sound !== null) active.play(sound);
  }, [shotCount, state.phase, state.turn, state.playerShots, state.aiShots, muted]);

  useEffect(() => () => playerRef.current?.close(), []);
}
