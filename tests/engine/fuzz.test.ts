import { describe, expect, it } from 'vitest';
import { createHuntTargetAi } from '../../src/engine/ai/huntTarget';
import { toObservedShots } from '../../src/engine/ai/types';
import { coordKey } from '../../src/engine/board';
import { BOARD_SIZE } from '../../src/engine/constants';
import { aiFire, newGame, playerFire } from '../../src/engine/game';
import { deriveSeed, mulberry32 } from '../../src/engine/rng';
import { assertBoardConsistent } from '../helpers/invariants';

const MAX_TURNS = BOARD_SIZE * BOARD_SIZE * 2 + 2;

describe('seeded full games', () => {
  it('always terminate with consistent boards and no repeated shots', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      let state = newGame(seed);
      const playerAi = createHuntTargetAi(mulberry32(deriveSeed(seed, 77)));
      let turns = 0;

      while (state.phase === 'playing' && turns < MAX_TURNS) {
        if (state.turn === 'player') {
          const target = playerAi.nextShot({
            boardSize: BOARD_SIZE,
            shots: toObservedShots(state.playerShots),
          });
          state = playerFire(state, target).state;
        } else {
          state = aiFire(state).state;
        }
        turns += 1;
      }

      expect(state.phase === 'playerWon' || state.phase === 'aiWon').toBe(true);
      expect(turns).toBeLessThan(MAX_TURNS);
      expect(state.playerShots.length).toBeLessThanOrEqual(100);
      expect(state.aiShots.length).toBeLessThanOrEqual(100);
      expect(new Set(state.playerShots.map((shot) => coordKey(shot.coord))).size).toBe(
        state.playerShots.length,
      );
      expect(new Set(state.aiShots.map((shot) => coordKey(shot.coord))).size).toBe(
        state.aiShots.length,
      );
      assertBoardConsistent(state.player, state.aiShots);
      assertBoardConsistent(state.ai, state.playerShots);
    }
  });
});
