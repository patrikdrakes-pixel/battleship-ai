import { createHuntTargetAi } from './ai/huntTarget';
import type { AiStrategy } from './ai/types';
import { toObservedShots } from './ai/types';
import { applyShot, isFleetSunk } from './board';
import { BOARD_SIZE } from './constants';
import { randomPlacement } from './placement';
import { deriveSeed, mulberry32, randomSeed } from './rng';
import type { Coord, GameState, Shot, ShotOutcome } from './types';

export type GameAction =
  | { readonly type: 'FIRE'; readonly coord: Coord }
  | { readonly type: 'AI_TURN' }
  | { readonly type: 'NEW_GAME'; readonly seed?: number };

export function newGame(seed: number = randomSeed()): GameState {
  return {
    player: randomPlacement(mulberry32(deriveSeed(seed, 0))),
    ai: randomPlacement(mulberry32(deriveSeed(seed, 1))),
    turn: 'player',
    phase: 'playing',
    playerShots: [],
    aiShots: [],
    seed,
  };
}

export interface FireResult {
  readonly state: GameState;
  readonly outcome: ShotOutcome;
}

/**
 * The player fires at the AI board. Rejected inputs (out of turn, finished
 * game, already targeted cell) return the same state object.
 */
export function playerFire(state: GameState, coord: Coord): FireResult {
  if (state.phase !== 'playing' || state.turn !== 'player') {
    return { state, outcome: { kind: 'repeat' } };
  }
  const { board, outcome } = applyShot(state.ai, coord);
  if (outcome.kind === 'repeat') {
    return { state, outcome };
  }
  const shot: Shot = { coord, outcome };
  const won = isFleetSunk(board);
  return {
    state: {
      ...state,
      ai: board,
      playerShots: [...state.playerShots, shot],
      // The win check happens in the same step as the shot, so a losing side
      // never gets a reply shot.
      phase: won ? 'playerWon' : 'playing',
      turn: won ? 'player' : 'ai',
    },
    outcome,
  };
}

/** The AI fires at the player board. Only legal while it is the AI's turn. */
export function aiFire(state: GameState, strategy?: AiStrategy): FireResult {
  if (state.phase !== 'playing' || state.turn !== 'ai') {
    return { state, outcome: { kind: 'repeat' } };
  }
  const ai =
    strategy ??
    createHuntTargetAi(mulberry32(deriveSeed(state.seed, state.aiShots.length + 2)));
  const coord = ai.nextShot({
    boardSize: BOARD_SIZE,
    shots: toObservedShots(state.aiShots),
  });
  const { board, outcome } = applyShot(state.player, coord);
  if (outcome.kind === 'repeat') {
    throw new Error(`AI strategy fired twice at ${coord.r},${coord.c}`);
  }
  const shot: Shot = { coord, outcome };
  const lost = isFleetSunk(board);
  return {
    state: {
      ...state,
      player: board,
      aiShots: [...state.aiShots, shot],
      phase: lost ? 'aiWon' : 'playing',
      turn: lost ? 'ai' : 'player',
    },
    outcome,
  };
}

/** Single entry point for every state transition; the UI only dispatches. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'FIRE':
      return playerFire(state, action.coord).state;
    case 'AI_TURN':
      return aiFire(state).state;
    case 'NEW_GAME':
      return newGame(action.seed);
  }
}
