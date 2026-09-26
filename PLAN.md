# Battleship — Technical Plan

Repo state: `patrikdrakes-pixel/battleship-ai` is empty (README only, 1 commit). Greenfield, so everything below is new.

## 1. Architecture

Three layers, one-way dependency: **UI → hooks → engine**. The engine is the lowest-level layer and depends on nothing above it — no React, no hooks, no UI code (no React import anywhere under `src/engine`, enforced by an ESLint `no-restricted-imports` rule). That is what makes the rules and AI unit-testable without a DOM and keeps the AI swappable.

```
src/
  engine/
    types.ts          # Coord, Cell, Ship, Board, ShotResult, GameState, Difficulty
    constants.ts      # BOARD_SIZE=10, FLEET=[5,4,3,3,2]
    board.ts          # createEmptyBoard, canPlace, placeShip, applyShot, isFleetSunk
    placement.ts      # randomPlacement(rng) -> Ship[]  (retry-with-restart)
    rng.ts            # Rng interface + mulberry32 seeded impl (deterministic tests)
    game.ts           # pure reducer: newGame(seed), playerFire(state, coord), aiFire(state)
    ai/
      types.ts        # AiStrategy { nextShot(view: AiView): Coord }
      huntTarget.ts   # hunt/target implementation
  ui/
    App.tsx
    components/Board.tsx, Cell.tsx, FleetStatus.tsx, StatusBanner.tsx, NewGameButton.tsx
    hooks/useGame.ts  # useReducer over engine.game + AI turn effect
    styles/
  main.tsx
tests/            # vitest unit tests mirroring src/engine
e2e/              # Playwright specs
.github/workflows/ci.yml
README.md  BUGS.md  vercel.json
```

Stack: Vite + React 18 + TS strict, Vitest + @testing-library/react for units, Playwright for E2E, ESLint (flat config) + Prettier, GitHub Actions, Vercel.

## 2. Key data structures

```ts
type Coord = { r: number; c: number }; // 0..9
type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
type Orientation = 'H' | 'V';

interface Ship {
  id: ShipId;
  size: number;
  origin: Coord;
  orientation: Orientation;
  hits: number;
}

type CellState = 'empty' | 'ship' | 'hit' | 'miss';

interface Board {
  ships: Ship[];
  grid: CellState[][]; // 10x10, source of truth for rendering
  shipAt: (ShipId | null)[][]; // O(1) hit → ship lookup, avoids scanning the fleet
}

type ShotOutcome =
  | { kind: 'miss' }
  | { kind: 'hit'; shipId: ShipId }
  | { kind: 'sunk'; shipId: ShipId; size: number }
  | { kind: 'repeat' }; // rejected, turn does not pass

interface Shot {
  coord: Coord;
  outcome: ShotOutcome;
}
```

`shipAt` is the one piece of denormalization worth having: hit resolution and sunk detection become O(1) instead of O(fleet·size), and it removes the classic "sunk reported on the wrong ship" bug class.

## 3. Game state model

```ts
type Phase = 'playing' | 'playerWon' | 'aiWon';

interface GameState {
  player: Board; // player's own fleet, AI shoots here
  ai: Board; // AI fleet, hidden; player shoots here
  turn: 'player' | 'ai';
  phase: Phase;
  playerShots: Shot[]; // player's shots at the AI board
  aiShots: Shot[]; // AI's shots at the player board
  seed: number;
}
```

- Transitions are pure functions `(state, input) => state`; React holds it via `useReducer`. No mutation, no `Date.now()`/`Math.random()` inside — randomness enters only through an injected `Rng`, so any game is reproducible from `seed` (critical for reproducing bugs reported in BUGS.md).
- Turn sequencing: player click → `playerFire` → if win, stop; else `turn='ai'` → a ~400 ms effect delay for readability → `aiFire` → back to `'player'`. Input is locked while `turn !== 'player'` or `phase !== 'playing'`, both in the reducer (guard) and in the UI (disabled cells). Guarding only in the UI is how double-fire/out-of-turn bugs happen.
- Shots at already-targeted cells return `repeat` and do not consume a turn.

### Allowed transitions

All of these live in `engine/game.ts` as pure functions; the UI dispatches intents (`FIRE`, `AI_TURN`, `NEW_GAME`) and renders `phase`/`turn`. No turn flipping, win checking, or duplicate-shot filtering in components.

| #   | From (`phase`, `turn`)             | Input               | Guard                               | To                    | Effect                                                                                                 |
| --- | ---------------------------------- | ------------------- | ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `playing`, `player`                | `FIRE(coord)`       | coord untargeted, not a winning hit | `playing`, `ai`       | append to `playerShots` with `miss`/`hit`/`sunk`; mark AI grid                                         |
| 2   | `playing`, `ai`                    | `AI_TURN`           | AI shot is not a winning hit        | `playing`, `player`   | strategy picks from `allCells \ aiShots`; append to `aiShots`; mark player grid                        |
| 3   | `playing`, `player`                | `FIRE(coord)`       | shot sinks the last AI ship         | `playerWon`, `player` | record `sunk`; no AI turn is scheduled                                                                 |
| 4   | `playing`, `ai`                    | `AI_TURN`           | shot sinks the last player ship     | `aiWon`, `ai`         | record `sunk`; game over                                                                               |
| 5   | `playing`, `player`                | `FIRE(coord)`       | coord already in `playerShots`      | unchanged             | returns `repeat`; no state mutation, turn stays `player`                                               |
| 6   | `playing`, `ai`                    | `FIRE(coord)`       | not the player's turn               | unchanged             | ignored (out-of-turn / double-click guard)                                                             |
| 7   | any terminal (`playerWon`/`aiWon`) | `FIRE` or `AI_TURN` | —                                   | unchanged             | ignored                                                                                                |
| 8   | any                                | `NEW_GAME(seed?)`   | —                                   | `playing`, `player`   | fresh `newGame(seed)`: both boards re-placed, both shot histories emptied, AI strategy state discarded |

Notes:

- Transitions 3 and 4 are why the win check happens inside the same reducer step as the shot — checking it afterwards in an effect is how "AI gets a free shot after losing" bugs appear.
- The AI never fires by its own volition: `AI_TURN` is only valid in (`playing`, `ai`), so transition 2 can fire at most once per player shot. The ~400 ms delay is a UI effect only; the state is already `turn: 'ai'` and input is locked during it.
- `repeat` (5) is a rejected input, not a state: the reducer returns the same object, so React does not even re-render.
- `NEW_GAME` is total — valid from every state, including mid-turn — and resets AI strategy state, which is derived from `aiShots` rather than held separately precisely so reset cannot leave it stale.

## 4. AI strategy (hunt/target)

The strategy is a pure function of an `AiView` — `{ boardSize, shots: Shot[] }` (its own previous shots and their results) — plus its internal derivation from that view. It never sees the player's ship layout, which is enforced by the type: it has no access to a `Board`.

- **Hunt mode** (no unresolved hits): fire at a random untried cell on the parity lattice `(r + c) % 2 === 0`. The smallest ship is length 2, so every ship must touch that lattice — this roughly halves the search space vs. uniform random. Fall back to any untried cell when the lattice is exhausted.
- **Target mode** (unresolved hits from a not-yet-sunk ship): maintain a frontier of the 4 orthogonal neighbours of those hits. Once two hits are collinear, lock the axis and fire only at the two ends of that run, extending until a miss, a board edge, or a sunk result.
- **On `sunk`**: remove that ship's hits from the unresolved set and clear the frontier of cells attributable only to it, then return to hunt. Getting this wrong (stale targets after a sink, especially with adjacent ships) is the main correctness risk in the strategy and gets dedicated tests.
- **No repeat fire** is guaranteed by deriving candidates as `allCells \ shotCells` in every mode, never by memory alone.
- Optional stretch: a probability-density strategy behind the same `AiStrategy` interface, selectable as a difficulty; not required for v1.

## 5. Testing strategy

- **Unit (Vitest)** — rules: placement is in-bounds, non-overlapping, and correct sizes over hundreds of seeds; hit/miss/sunk/win transitions; repeat shots rejected and turn preserved; win detected exactly when all 17 cells of a fleet are hit.
- **Unit — denormalization invariants**: a shared `assertBoardConsistent(board, shots)` helper, asserted after initial placement, after a hit, after a miss, and after a sink (and again after the whole fleet is sunk). It checks:
  - every cell whose state is `ship` or `hit` resolves in `shipAt` to a `ShipId` that exists in `ships`, and `null` everywhere else;
  - each ship's footprint derived from `origin`/`orientation`/`size` matches exactly the cells `shipAt` attributes to it (right count, right coords, in bounds);
  - `ship.hits` equals the number of `hit` cells in its footprint, equals the number of shots in the history that landed on it, and `0 <= hits <= size`;
  - a ship is reported sunk iff `hits === size` and all its footprint cells are `hit`;
  - `grid` cell states agree with the shot history: every shot coord is `hit` or `miss` (`hit` iff `shipAt` is non-null there), and every non-shot coord is `empty` or `ship`.
    The helper also runs at the end of the seeded full-game fuzz runs, so consistency is checked across hundreds of random game trajectories, not just the four hand-built cases.
- **Unit — AI**: never repeats a cell (drive a full 100-shot game and assert 100 distinct coords); switches to target mode after a hit; sinks a ship in bounded shots; handles adjacent ships and ships flush against edges/corners; returns to hunt after a sink. Seeded RNG keeps these deterministic.
- **Property/fuzz**: run N seeded full games headlessly; assert no crash, every game terminates ≤ 200 shots, and shot counts never exceed the board.
- **Component (RTL)**: clicking a cell marks it and disables it; status banner text tracks the state; New Game resets both boards.
- **E2E (Playwright)**: load, play a full seeded game to a win via `?seed=` and to a loss, verify banners, New Game, and mobile viewport layout. Also used as the browser verification for BUGS.md entries.
- Coverage gate on `src/engine` (target ≥ 90% lines) — the UI is not held to the same bar.

## 6. Security considerations

The app is client-side only with no user accounts, no backend, and no persisted PII, so the real surface is supply chain and deployment.

- Dependabot (npm + github-actions, weekly) and `npm audit --audit-level=high` in CI; CodeQL for JS/TS on PRs; pinned `package-lock.json` with `npm ci` everywhere. Prefer deps published ≥ 7 days ago.
- No `dangerouslySetInnerHTML`, no `eval`; all rendered content is enum-derived, so XSS surface is effectively nil. Any URL param (`seed`) is validated as an integer before use.
- CI workflows get least-privilege `permissions:` (`contents: read`), no secrets exposed to PR-triggered jobs, actions pinned by major version at minimum.
- Vercel: static SPA, security headers via `vercel.json` (`Content-Security-Policy` with no `unsafe-eval`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`), preview deploys per PR, production on `main`.
- Honest note: the AI's board lives in the client, so a determined player can read the ship layout from memory. That is inherent to a serverless single-player game; mitigating it would require a server authority and is explicitly out of scope.

## 7. Definition of Done

1. `npm ci && npm run build` clean; TS strict with no `any`, no suppressions.
2. `npm run lint` and `npm run typecheck` clean.
3. Unit tests pass, engine coverage ≥ 90%; AI no-repeat and sink-handling tests included.
4. Playwright E2E green in CI (headless) covering a full win and a full loss.
5. All product requirements demonstrably met: 10×10, fleet 5/4/3/3/2, random legal placement, click-to-fire, hit/miss/sunk/win/loss states, AI fires after the player at most once per cell, hunt/target, New Game, responsive down to 360 px.
6. CI (GitHub Actions) green on the PR: lint, typecheck, unit, E2E, audit, CodeQL.
7. Deployed to Vercel with a working production URL; preview URL on the PR.
8. README covers architecture, local dev, tests, deployment. BUGS.md documents **real** defects found during development, each with symptom / root cause / fix / verification — not invented entries.

## 8. Engineering trade-offs

- **Pure engine vs. React state**: more boilerplate and an explicit `Rng` seam, bought in exchange for fast deterministic tests and an AI that cannot cheat. Worth it here; this is the core of the exercise.
- **`shipAt` index (denormalized)**: duplicate state to keep in sync, in exchange for O(1) sunk detection and fewer off-by-one bugs. Sync is confined to `placeShip`, so the risk is contained.
- **Hunt/target with parity vs. probability density**: parity hunt is ~30 lines and explainable; a Monte-Carlo/density AI plays measurably better but is harder to test and reason about. Ship hunt/target, leave the interface open for density later.
- **Random placement only (no manual placement)**: cuts a drag-and-drop UI and its whole test surface; not in the requirements.
- **Playwright vs. Cypress**: Playwright for cheaper CI parallelism and native multi-viewport testing.
- **Artificial AI delay (~400 ms)**: worse for E2E speed (needs deterministic waits on state, not timers), better for human readability. Mitigate by making the delay configurable to 0 in tests.
- **No backend / no persistence**: no anti-cheat and no resume-after-refresh, in exchange for a trivial deploy story and zero server security surface.
