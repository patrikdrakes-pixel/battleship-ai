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

  const playerCount = state.playerShots.length;
  const aiCount = state.aiShots.length;
  const seen = useRef({ player: playerCount, ai: aiCount });
  const lastPhase = useRef(state.phase);

  useEffect(() => {
    const active = playerRef.current;
    if (active === null) return;

    const newest =
      playerCount > seen.current.player
        ? state.playerShots.at(-1)
        : aiCount > seen.current.ai
          ? state.aiShots.at(-1)
          : undefined;
    seen.current = { player: playerCount, ai: aiCount };
    const phaseChanged = state.phase !== lastPhase.current;
    lastPhase.current = state.phase;

    if (muted) return;
    const sound = outcomeSound(newest);
    if (sound !== null) active.play(sound);
    if (phaseChanged && state.phase !== 'playing') {
      active.play(state.phase === 'playerWon' ? 'win' : 'loss');
    }
  }, [playerCount, aiCount, state.phase, state.playerShots, state.aiShots, muted]);

  useEffect(() => () => playerRef.current?.close(), []);
}
