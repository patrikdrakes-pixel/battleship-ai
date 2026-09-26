# Battleship

A small Battleship game played in the browser against a hunt/target AI opponent.
React + TypeScript + Vite, with the game rules implemented as a framework-free engine.

- 10×10 boards, standard fleet (5, 4, 3, 3, 2), random legal placement
- Click an enemy cell to fire; hit / miss / sunk / win / loss are all shown
- The AI replies after every player shot and never fires at a cell twice
- New Game restarts at any time; games are reproducible with `?seed=`

## Architecture

Dependency direction is one-way: **UI → hooks → engine**. The engine is the lowest-level
layer and does not import React, hooks, or UI code — enforced by an ESLint
`no-restricted-imports` rule scoped to `src/engine/**`.

```
src/
  engine/              pure TypeScript, no framework imports
    types.ts           Coord, Ship, Board, Shot, GameState
    constants.ts       BOARD_SIZE, FLEET
    rng.ts             mulberry32 seeded RNG + deriveSeed
    board.ts           placement legality, applyShot, sunk/fleet checks
    placement.ts       random legal fleet placement
    game.ts            newGame, playerFire, aiFire, gameReducer (all transitions)
    ai/
      types.ts         AiView, AiStrategy, ObservedShot
      huntTarget.ts    hunt/target strategy
  ui/
    hooks/useGame.ts   useReducer(gameReducer) + cosmetic AI delay
    components/        Board, Cell, FleetStatus, NewGameButton, StatusBanner
    App.tsx, labels.ts, styles/app.css
  main.tsx             entry point, parses ?seed= and ?delay=
```

### Game state and transitions

All transitions live in `gameReducer` (`src/engine/game.ts`); the UI only dispatches
intents (`FIRE`, `AI_TURN`, `NEW_GAME`) and renders `phase` / `turn`.

| From (`phase`, `turn`) | Action                               | Condition                                     | To                  |
| ---------------------- | ------------------------------------ | --------------------------------------------- | ------------------- |
| `playing`, `player`    | `FIRE(coord)`                        | cell untargeted, not the last enemy ship cell | `playing`, `ai`     |
| `playing`, `ai`        | `AI_TURN`                            | shot does not sink the last player ship       | `playing`, `player` |
| `playing`, `player`    | `FIRE(coord)`                        | shot sinks the last enemy ship                | `playerWon`         |
| `playing`, `ai`        | `AI_TURN`                            | shot sinks the last player ship               | `aiWon`             |
| `playing`, `player`    | `FIRE(coord)`                        | already fired at `coord`                      | unchanged           |
| any                    | out-of-turn or terminal-state action | —                                             | unchanged           |
| any                    | `NEW_GAME(seed?)`                    | —                                             | `playing`, `player` |

The win check happens in the same step as the shot, so a losing side never gets a reply
shot. The AI keeps no mutable state: its next move is derived from its own shot history,
so a reset cannot leave it stale.

### AI

`createHuntTargetAi(rng)` sees only an `AiView` — board size plus its own previous shots
and their observed outcomes (a plain hit does not reveal which ship was struck; a sink
reveals ship id and size). It never receives the player's `Board`.

- **Hunt**: uniformly random cell on the `(r + c) % 2 === 0` parity lattice (the smallest
  ship is 2 cells, so this cannot miss a ship), falling back to any untried cell.
- **Target**: after a hit, it fires at orthogonal neighbours of unresolved hits; with two
  or more collinear hits it locks to that axis and extends both ends of the run.
- Sinking a ship retires that hit cluster, so the AI returns to hunting unless another
  damaged ship remains.

## Local development

Requires Node 24 (or any version supported by Vite 8).

```bash
npm ci
npm run dev        # http://localhost:5173
```

Useful query parameters: `?seed=12345` for a reproducible game, `?delay=0` to remove the
cosmetic AI thinking delay.

## Tests and checks

```bash
npm run lint         # ESLint (type-aware) incl. the engine import restriction
npm run format:check # Prettier
npm run typecheck    # tsc -b (strict, no `any`)
npm test             # Vitest unit + component tests
npm run test:coverage# same with V8 coverage thresholds on src/engine
npm run build        # typecheck + production build
npm run e2e:install  # one-off: Playwright browsers
npm run e2e          # Playwright, desktop + mobile viewport
```

What is covered:

- **Rules** (`tests/engine/board.test.ts`): bounds, overlap, repeat shots, immutability,
  and an `assertBoardConsistent` invariant that re-checks `ships` / `grid` / `shipAt`
  agreement against the shot history after placement, a miss, a hit, a sink, and a wipe.
- **Placement** (`tests/engine/placement.test.ts`): 300 seeded fleets are legal, 17 cells,
  deterministic per seed, both orientations occur.
- **Transitions** (`tests/engine/game.test.ts`): player → AI → player, both wins, repeat
  shots, out-of-turn input, reset.
- **AI** (`tests/engine/ai.test.ts`): never repeats a shot, hunt → target after a hit,
  correct axis after multiple hits, back to hunt after a sink, edges and corners.
- **Fuzz** (`tests/engine/fuzz.test.ts`): 60 seeded full games terminate with no repeated
  shots and consistent boards.
- **UI** (`tests/ui/app.test.tsx`) and **E2E** (`e2e/game.spec.ts`): rendering, hidden
  enemy fleet, click-to-fire, a full win, a full loss, and New Game.

CI (`.github/workflows/ci.yml`) runs lint, format, typecheck, coverage, build, Playwright
and `npm audit` on every pull request; CodeQL and Dependabot run alongside it.

## Deployment

The app is a static SPA deployed to Vercel. `vercel.json` pins the build
(`npm ci` / `npm run build` / `dist`) and sets security headers (strict CSP with no inline
scripts, `nosniff`, `frame-ancestors 'none'`, HSTS, restrictive Permissions-Policy).

```bash
npx vercel            # preview deployment
npx vercel --prod     # production deployment
```

Connecting the GitHub repository in the Vercel dashboard gives preview deployments per PR
and production deployments from `main` with no extra configuration.

## Security notes

- No backend, no network calls, no user data storage — the whole game runs client-side.
- No `dangerouslySetInnerHTML`; all rendering goes through React escaping.
- The only untrusted input is the `?seed=` / `?delay=` query string, validated against
  `^\d{1,10}$` and `Number.isSafeInteger` before use.
- Dependencies are dev-only apart from React; `npm audit` gates CI and Dependabot keeps
  updates flowing.

See [BUGS.md](./BUGS.md) for defects found during development and [PLAN.md](./PLAN.md) for
the original design notes.
