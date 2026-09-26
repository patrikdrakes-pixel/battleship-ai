import { describe, expect, it } from 'vitest';
import { shipCells } from '../../src/engine/board';
import { BOARD_SIZE } from '../../src/engine/constants';
import { aiFire, gameReducer, newGame, playerFire } from '../../src/engine/game';
import type { Coord, GameState } from '../../src/engine/types';
import { assertBoardConsistent } from '../helpers/invariants';

function aiShipCells(state: GameState): Coord[] {
  return state.ai.ships.flatMap((ship) => shipCells(ship));
}

function waterCells(state: GameState): Coord[] {
  const cells: Coord[] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (state.ai.shipAt[r][c] === null) cells.push({ r, c });
    }
  }
  return cells;
}

/** Player fires only at water, so the AI is the only side that can win. */
function playUntilAiWins(seed: number): GameState {
  let state = newGame(seed);
  const water = waterCells(state);
  let index = 0;
  while (state.phase === 'playing' && index < water.length) {
    if (state.turn === 'player') {
      state = playerFire(state, water[index++]).state;
    } else {
      state = aiFire(state).state;
    }
  }
  return state;
}

describe('transition: player -> ai -> player', () => {
  it('hands the turn to the AI after a player shot and back again', () => {
    const start = newGame(7);
    expect(start.turn).toBe('player');
    expect(start.phase).toBe('playing');

    const afterPlayer = playerFire(start, { r: 0, c: 0 }).state;
    expect(afterPlayer.turn).toBe('ai');
    expect(afterPlayer.playerShots).toHaveLength(1);
    expect(afterPlayer.aiShots).toHaveLength(0);

    const afterAi = aiFire(afterPlayer).state;
    expect(afterAi.turn).toBe('player');
    expect(afterAi.aiShots).toHaveLength(1);
    assertBoardConsistent(afterAi.player, afterAi.aiShots);
    assertBoardConsistent(afterAi.ai, afterAi.playerShots);
  });

  it('is deterministic for a given seed', () => {
    const a = aiFire(playerFire(newGame(99), { r: 5, c: 5 }).state).state;
    const b = aiFire(playerFire(newGame(99), { r: 5, c: 5 }).state).state;
    expect(a.aiShots).toEqual(b.aiShots);
  });
});

describe('transition: player win', () => {
  it('ends the game the moment the last enemy ship sinks and grants no AI reply', () => {
    let state = newGame(11);
    const targets = aiShipCells(state);
    for (const target of targets) {
      if (state.turn === 'ai') state = aiFire(state).state;
      const result = playerFire(state, target);
      state = result.state;
    }

    expect(state.phase).toBe('playerWon');
    expect(state.turn).toBe('player');
    expect(state.playerShots).toHaveLength(17);
    expect(state.playerShots[16].outcome.kind).toBe('sunk');

    const afterWin = aiFire(state);
    expect(afterWin.state).toBe(state);
    expect(afterWin.outcome).toEqual({ kind: 'repeat' });
  });
});

describe('transition: AI win', () => {
  it('ends the game when the player fleet is destroyed', () => {
    const state = playUntilAiWins(3);
    expect(state.phase).toBe('aiWon');
    expect(state.turn).toBe('ai');
    expect(state.player.ships.every((ship) => ship.hits === ship.size)).toBe(true);
    assertBoardConsistent(state.player, state.aiShots);

    expect(playerFire(state, { r: 0, c: 0 }).state).toBe(state);
  });
});

describe('transition: repeated shot', () => {
  it('rejects the input, keeps the turn and does not change state', () => {
    const first = playerFire(newGame(5), { r: 3, c: 3 }).state;
    const backToPlayer = aiFire(first).state;
    const repeat = playerFire(backToPlayer, { r: 3, c: 3 });

    expect(repeat.outcome).toEqual({ kind: 'repeat' });
    expect(repeat.state).toBe(backToPlayer);
    expect(repeat.state.turn).toBe('player');
    expect(repeat.state.playerShots).toHaveLength(1);
  });

  it('ignores player shots fired out of turn', () => {
    const awaitingAi = playerFire(newGame(5), { r: 3, c: 3 }).state;
    const outOfTurn = playerFire(awaitingAi, { r: 4, c: 4 });
    expect(outOfTurn.state).toBe(awaitingAi);
    expect(outOfTurn.outcome).toEqual({ kind: 'repeat' });
  });
});

describe('transition: new game', () => {
  it('resets boards, shots, turn and phase from any state', () => {
    const finished = playUntilAiWins(3);
    const fresh = gameReducer(finished, { type: 'NEW_GAME', seed: 21 });

    expect(fresh.phase).toBe('playing');
    expect(fresh.turn).toBe('player');
    expect(fresh.playerShots).toEqual([]);
    expect(fresh.aiShots).toEqual([]);
    expect(fresh.player.ships.every((ship) => ship.hits === 0)).toBe(true);
    assertBoardConsistent(fresh.player, []);
    assertBoardConsistent(fresh.ai, []);
  });
});

describe('gameReducer', () => {
  it('routes every action through the engine', () => {
    const start = newGame(1);
    const fired = gameReducer(start, { type: 'FIRE', coord: { r: 2, c: 2 } });
    expect(fired.turn).toBe('ai');
    const replied = gameReducer(fired, { type: 'AI_TURN' });
    expect(replied.turn).toBe('player');
    expect(gameReducer(replied, { type: 'AI_TURN' })).toBe(replied);
  });
});
