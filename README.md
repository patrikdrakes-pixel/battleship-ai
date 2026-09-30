# Battleship

A small Battleship game played in the browser against a hunt/target AI opponent.
React + TypeScript + Vite, with the game rules implemented as a framework-free engine.

- 10×10 boards, standard fleet (5, 4, 3, 3, 2), random legal placement, drawn as SVG
  hulls (your fleet always; enemy ships only once sunk or the game ends)
- Click an enemy cell to fire; hit / miss / sunk / win / loss are all shown, with a
  board legend, a ring on the newest shot of each board, and brief shot animations
  (suppressed under `prefers-reduced-motion`)
- The AI replies after every player shot and never fires at a cell twice
- When the game ends an overlay reports the result, shots, accuracy, ships sunk and
  lost, and offers Play again, a difficulty switch, or dismissal to review the boards
- New Game restarts at any time; games are reproducible with `?seed=`
- Easy / Medium / Hard AI difficulty, selectable at any time
- Optional manual fleet placement: Place ships opens a setup board with a legality
  preview, rotate, random and clear; random placement stays the default
- Synthesised sound for miss / hit / sunk / win / loss, with a Sound on|off toggle
- Difficulty, mute and the win/loss record are remembered in `localStorage` per device

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
      random.ts        easy strategy (random untried cell)
      huntTarget.ts    medium strategy (parity hunt + target)
      probability.ts   hard strategy (probability density)
      index.ts         DIFFICULTIES and createAi(difficulty, rng)
  ui/
    hooks/useGame.ts   useReducer(gameReducer) + cosmetic AI delay
    components/        Board, Cell, ShipLayer, Legend, FleetStatus, StatusBanner,
                       DifficultySelect, NewGameButton, GameOverOverlay,
                       PlacementScreen, PlacementBoard, MuteToggle
    hooks/useSound.ts  plays a blip per new shot and per result
    hooks/useMatchRecord.ts  counts each finished game once
    sound.ts           WebAudio tone synthesis (no audio assets)
    storage.ts         best-effort localStorage for preferences and the record
    App.tsx, labels.ts, stats.ts, styles/app.css
  main.tsx             entry point, parses ?seed=, ?delay= and ?difficulty=
```

### Game state and transitions

All transitions live in `gameReducer` (`src/engine/game.ts`); the UI only dispatches
intents (`FIRE`, `AI_TURN`, `NEW_GAME`) and renders `phase` / `turn`.

| From (`phase`, `turn`) | Action                                       | Condition                                     | To                  |
| ---------------------- | -------------------------------------------- | --------------------------------------------- | ------------------- |
| `playing`, `player`    | `FIRE(coord)`                                | cell untargeted, not the last enemy ship cell | `playing`, `ai`     |
| `playing`, `ai`        | `AI_TURN`                                    | shot does not sink the last player ship       | `playing`, `player` |
| `playing`, `player`    | `FIRE(coord)`                                | shot sinks the last enemy ship                | `playerWon`         |
| `playing`, `ai`        | `AI_TURN`                                    | shot sinks the last player ship               | `aiWon`             |
| `playing`, `player`    | `FIRE(coord)`                                | already fired at `coord`                      | unchanged           |
| any                    | out-of-turn or terminal-state action         | —                                             | unchanged           |
| any                    | `NEW_GAME(seed?, difficulty?, playerBoard?)` | —                                             | `playing`, `player` |

The win check happens in the same step as the shot, so a losing side never gets a reply
shot. The AI keeps no mutable state: its next move is derived from its own shot history,
so a reset cannot leave it stale.

### Fleet placement

Both fleets are placed by the engine. `NEW_GAME` without `playerBoard` places the player
fleet randomly from the seed, exactly as before; with one it adopts that layout after
`assertPlaceableFleet` has checked the fleet is complete, correctly sized, in bounds,
non-overlapping and unfired — an illegal layout throws instead of entering game state.
The AI fleet is always random. The setup UI owns no rules: it builds its board with
`canPlace` / `placeShip` and hands the finished one to the reducer.

### AI and difficulty

Every difficulty is an `AiStrategy` in the engine; `createAi(difficulty, rng)` maps the
setting to a strategy, and the UI only stores the chosen `difficulty` in game state.

- **Easy** (`createRandomAi`): uniformly random untried cell; it ignores hit/miss
  outcomes entirely, so it never chases a damaged ship.
- **Medium** (`createHuntTargetAi`): the parity hunt / orthogonal target strategy
  described below — the default.
- **Hard** (`createProbabilityAi`): probability density. It enumerates every legal
  placement of the ships still afloat, discards placements crossing a known miss,
  weights placements that explain unresolved hits, and fires at the untried cell covered
  by the most placements (seeded randomness only breaks ties).

Difficulty is chosen in the header selector; picking a new one immediately starts a fresh
game at that setting, and New Game keeps the current setting. `?difficulty=easy|medium|hard`
sets the initial value.

All three strategies see only an `AiView` — board size plus its own previous shots
and their observed outcomes (a plain hit does not reveal which ship was struck; a sink
reveals ship id and size). They never receive the player's `Board`.

Medium in detail:

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
cosmetic AI thinking delay, `?difficulty=hard` for the starting difficulty.

## Tests and checks

```bash
npm run lint         # ESLint (type-aware) incl. the engine import restriction
npm run format:check # Prettier
npm run typecheck    # tsc -b (strict, no `any`)
npm test             # Vitest unit + component tests
npm run test:coverage# same with V8 coverage thresholds on src/engine
npm run build        # typecheck + production build
npm run e2e:install  # one-off: Playwright browsers
npm run e2e          # Playwright, desktop + mobile viewport (skips @visual)
npm run e2e:visual:docker  # visual regression in the pinned Playwright image
```

What is covered:

- **Rules** (`tests/engine/board.test.ts`): bounds, overlap, repeat shots, immutability,
  and an `assertBoardConsistent` invariant that re-checks `ships` / `grid` / `shipAt`
  agreement against the shot history after placement, a miss, a hit, a sink, and a wipe.
- **Placement** (`tests/engine/placement.test.ts`): 300 seeded fleets are legal, 17 cells,
  deterministic per seed, both orientations occur.
- **Manual placement** (`tests/engine/manualPlacement.test.ts`, `tests/ui/placement.test.tsx`,
  `e2e/placement.spec.ts`): `remainingFleet` / `assertPlaceableFleet` accept legal layouts
  and reject incomplete, mis-sized, overlapping, out-of-bounds and already-fired boards;
  `newGame` keeps a supplied layout and still randomizes the AI; the setup UI places,
  previews, rotates, randomizes, clears, cancels and starts a game.
- **Transitions** (`tests/engine/game.test.ts`): player → AI → player, both wins, repeat
  shots, out-of-turn input, reset.
- **AI** (`tests/engine/ai.test.ts`): never repeats a shot, hunt → target after a hit,
  correct axis after multiple hits, back to hunt after a sink, edges and corners.
- **Fuzz** (`tests/engine/fuzz.test.ts`): 60 seeded full games terminate with no repeated
  shots and consistent boards.
- **Sound** (`tests/ui/sound.test.tsx`): the outcome of each shot and the result play a
  blip, muting silences them, the toggle reports `aria-pressed`, and a missing or
  blocked `AudioContext` stays silent instead of throwing.
- **Persistence** (`tests/ui/storage.test.ts`, `tests/ui/persistence.test.tsx`): stored
  preferences are restored and written back, unknown or impossible stored values fall back
  to defaults, unavailable storage never throws, and a finished game is counted exactly once.
- **UI** (`tests/ui/app.test.tsx`) and **E2E** (`e2e/game.spec.ts`): rendering, hidden
  enemy fleet, click-to-fire, a full win, a full loss, and New Game.
- **Visual regression** (`e2e/visual.spec.ts`): screenshots of a fresh board, the
  miss/hit/sunk states, the end-game overlay and the placement screen, desktop and mobile. Pixel output depends
  on the OS font stack, so these run only inside `mcr.microsoft.com/playwright:<version>`
  — locally via `npm run e2e:visual:docker`, in CI as the "Visual regression" job. Append
  `-- --update-snapshots` to the docker script to re-record after an intended restyle, and
  keep the image tag in sync with `@playwright/test`.
- **Accessibility** (`e2e/a11y.spec.ts`): axe-core scans of the fresh board, the placement
  screen, and the finished game with its overlay, on desktop and mobile, asserting zero WCAG 2.1 A/AA
  violations.

## Accessibility

Enemy cells are real `<button>`s labelled `"B7, unexplored"` / `"hit"` / `"sunk"` and
disabled once fired; the player board renders `role="img"` cells with the same labels, and
the SVG hull layer is `aria-hidden`. The boards deliberately use no `grid`/`row` ARIA —
that contract requires roving-tabindex arrow-key navigation, which the game does not
implement. The end-game overlay is a modal dialog (`aria-modal`, labelled by its title)
that takes focus, traps Tab / Shift+Tab, and closes on Escape while its stats stay
selectable. Shot animations are suppressed under `prefers-reduced-motion`.

CI (`.github/workflows/ci.yml`) runs lint, format, typecheck, coverage, build, Playwright
and `npm audit` on every pull request; CodeQL and Dependabot run alongside it.

## Monitoring

- Vercel's included Observability provides deployment, traffic and hosting diagnostics.
- Sentry captures browser errors only when `VITE_SENTRY_DSN` is configured. Default PII
  collection and performance tracing are disabled; Session Replay is not enabled.
- `VITE_SENTRY_ENVIRONMENT` labels the events; without it the Vite mode is used, which is
  `production` for preview builds too. Set it to `preview` on Vercel preview deployments.
- One Sentry uptime monitor checks the production URL every five minutes. It is created in
  Sentry (Alerts → Uptime Monitors) against `https://battleship-ai.vercel.app/`, not from
  this repository.
- Source-map upload is intentionally not configured, so no Sentry auth token is needed.
- The setup uses the Vercel Hobby and Sentry Developer free tiers. Observability Plus,
  Sentry PAYG and other usage-based add-ons are not enabled.

## Deployment

The app is a static SPA deployed to Vercel. `vercel.json` pins the build
(`npm ci` / `npm run build` / `dist`) and sets security headers (strict CSP with no inline
scripts, a narrowly scoped Sentry ingest connection, `nosniff`, `frame-ancestors 'none'`,
HSTS, restrictive Permissions-Policy).

```bash
npx vercel            # preview deployment
npx vercel --prod     # production deployment
```

Connecting the GitHub repository in the Vercel dashboard gives preview deployments per PR
and production deployments from `main` with no extra configuration.

## Security notes

- No backend or user data storage; game state remains entirely client-side. The only
  optional application network traffic is browser error reporting to Sentry.
- No `dangerouslySetInnerHTML`; all rendering goes through React escaping.
- The only untrusted input is the `?seed=` / `?delay=` / `?difficulty=` query string, validated against
  `^\d{1,10}$` and `Number.isSafeInteger` before use.
- Runtime dependencies are React and the Sentry browser SDK; `npm audit` gates CI and
  Dependabot keeps updates flowing.

See [BUGS.md](./BUGS.md) for defects found during development and [PLAN.md](./PLAN.md) for
the original design notes.
