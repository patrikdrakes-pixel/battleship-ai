import type { Rng } from '../rng';
import type { Difficulty } from '../types';
import { createHuntTargetAi } from './huntTarget';
import { createProbabilityAi } from './probability';
import { createRandomAi } from './random';
import type { AiStrategy } from './types';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** The only place difficulty is mapped to behaviour. */
export function createAi(difficulty: Difficulty, rng: Rng): AiStrategy {
  switch (difficulty) {
    case 'easy':
      return createRandomAi(rng);
    case 'medium':
      return createHuntTargetAi(rng);
    case 'hard':
      return createProbabilityAi(rng);
  }
}
