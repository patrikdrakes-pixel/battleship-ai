# Defects found during development

Only defects actually hit while building this project are listed here.

## 1. Enemy cells could not be distinguished between "already fired" and "AI is thinking"

- **Symptom.** Two Playwright scenarios failed. The sink scenario reported
  `Expected substring: "sunk the Destroyer" / Received: "You fired at F1: hit!"`, and the
  loss scenario never reached `You lose` — the status stayed on `Your turn`. The tests
  skipped cells they believed had already been fired at.
- **Root cause.** `Cell` rendered `disabled={disabled || alreadyFired}`, collapsing two
  different states into one attribute: a cell already shot at, and every enemy cell while
  `turn === 'ai'`. Any consumer inspecting the DOM (assistive tech included) sees "not
  available" without knowing why, and the tests' `isDisabled()` check silently skipped
  cells that had never been fired at whenever it ran during the AI's reply.
- **Fix.** `Cell` now also emits `data-fired={alreadyFired}`, so the "already targeted"
  fact is represented independently of turn-based interactivity
  (`src/ui/components/Cell.tsx`). The E2E helpers read `data-fired` for that question and
  wait for the AI reply to finish before clicking.
- **Verification.** `npm run e2e` — 10/10 passing on the desktop and mobile projects,
  including the full-win and full-loss games that previously failed.

## 2. Sunk ships looked identical to a merely damaged ship

- **Symptom.** Found during browser testing: sinking the Carrier (`?seed=20260926`, fire
  F1–F5) announced the sink in the log and struck the ship out in the fleet panel, but its
  five cells stayed the same red as any other hit, so the board alone did not show which
  ships were finished.
- **Root cause.** `Cell` derived its appearance from `CellState` only, which has no `sunk`
  member — sunk-ness is a property of a `Ship`, not of a cell, and nothing joined the two.
- **Fix.** `Board` computes the sunk ships' cells (`board.ships.filter(isSunk)`) and passes
  `sunk` down; `Cell` renders `.cell--sunk` and exposes `data-sunk`, and the accessible
  label reads "sunk" instead of "hit".
- **Verification.** New E2E case `sunk ships are styled apart from plain hits`: the first
  destroyer cell is `data-sunk="false"`, and both cells flip to `true` once it sinks.

## 3. Horizontal overflow at a 320px viewport

- **Symptom.** Found during browser testing: at 320px the page scrolled sideways
  (`scrollWidth` 330 vs `clientWidth` 320), clipping column J and the fleet counters. 375px
  was fine.
- **Root cause.** `.boards` used `repeat(auto-fit, minmax(320px, 1fr))`. The 320px track
  floor is not reduced by `auto-fit`, so together with the page padding it exceeded the
  viewport on the narrowest phones.
- **Fix.** `minmax(min(320px, 100%), 1fr)` lets the track shrink to the container, plus
  tighter board padding and grid gaps under the 480px breakpoint.
- **Verification.** New E2E case `fits a 320px viewport without horizontal overflow`
  asserts zero overflow and that cell J10 is in the viewport.

## 4. The enemy fleet panel named the ship behind an unsunk hit

- **Symptom.** A plain hit on the enemy board bumped one named ship's counter in the
  "Enemy fleet" panel (`Carrier 1/5`), so the player learned which ship they had found —
  and its length — before sinking it.
- **Root cause.** `FleetStatus` rendered `ship.hits` for both fleets. Per-ship damage is
  public for your own fleet but hidden information for the opponent's.
- **Fix.** `FleetStatus` takes `revealDamage`; the enemy panel passes it only once the
  game is over, and shows `AFLOAT`/`SUNK` during play. Sinking is still announced, since
  the rules reveal it.
- **Verification.** Component test `does not reveal which enemy ship an unsunk hit belongs
  to`: after a hit on a carrier cell all five enemy entries still read `AFLOAT` and the
  panel contains no `1/5`.

## 5. AI could retire a live ship's hit when two ships touch

- **Symptom.** With two ships adjacent in the same line, sinking one could leave the AI
  hunting instead of finishing the neighbour it had already hit.
- **Root cause.** `retireSunkShip` had to split a run of hits longer than the sunk ship.
  It kept `run.slice(0, size)` — the sinking cell plus cells walked backwards — which is
  an arbitrary choice: if the sunk ship extended forwards, the retired set contained the
  neighbour's hit and kept a dead cell.
- **Fix.** Retire the whole run when its length matches the ship exactly; otherwise retire
  only the cells shared by every length-`size` window of the run that covers the sinking
  shot. Ambiguous cells stay targetable, which can cost a shot but never abandons a live
  ship.
- **Verification.** `never retires a live ship's hit when the run is ambiguous` and
  `keeps both candidates when a sink shot sits between two hits` in `tests/engine/ai.test.ts`,
  plus the existing 60-game fuzz suite and the AI effectiveness bound.

## 6. `placeShip` accepted a duplicate ship id

- **Symptom.** Calling `placeShip` twice with the same `ShipId` produced a board where
  `applyShot` credited hits to whichever entry it found first, so the fleet could read as
  destroyed while a ship was untouched. Not reachable from `randomPlacement`, but nothing
  stopped a future caller.
- **Root cause.** `placeShip` validated geometry only, never identity.
- **Fix.** Throw `Duplicate ship id <id>` when the board already carries that id.
- **Verification.** `rejects a ship id that is already on the board` in
  `tests/engine/board.test.ts`.

## 7. `npm run build` failed once the E2E specs imported engine code

- **Symptom.** `npx playwright test` aborted with
  `Error: Process from config.webServer was not able to start. Exit code: 2`; running the
  web server command directly showed `tsc -b` failing on `e2e/game.spec.ts` with
  unresolved relative imports (NodeNext requires explicit `.js` extensions) and implicit
  `any` parameters.
- **Root cause.** The E2E specs were compiled by `tsconfig.node.json`, which uses
  `module: NodeNext` for Vite/Playwright config files. The specs, however, import
  application source (`src/engine/...`, `src/ui/labels`) written for the bundler
  resolution used by the app.
- **Fix.** Added `tsconfig.e2e.json` (bundler resolution, `vite/client` types, includes
  `e2e` and `src`), referenced it from `tsconfig.json`, and dropped `e2e` from
  `tsconfig.node.json`.
- **Verification.** `npm run build` succeeds, and Playwright's managed preview server
  starts, so `npm run e2e` runs end to end.

## 8. Three moderate advisories in the initial dependency tree

- **Symptom.** `npm install` reported `3 moderate severity vulnerabilities`, which would
  have failed the `npm audit --audit-level=moderate` CI job on the first push.
- **Root cause.** The scaffolded Vitest version depended on a vulnerable `@vitest/mocker`
  release.
- **Fix.** Upgraded `vitest` and `@vitest/coverage-v8` to `^5.0.1` (and the other dev
  tooling to current majors) and reinstalled.
- **Verification.** `npm audit` reports `found 0 vulnerabilities`; the CI `audit` job runs
  it on every pull request.

## 9. Unbound event handlers in the component props

- **Symptom.** `npm run lint` failed with `@typescript-eslint/unbound-method` in
  `App.tsx`, `Board.tsx`, `Cell.tsx` and `NewGameButton.tsx`.
- **Root cause.** The callback props were declared as TypeScript _method_ signatures
  (`onFire(coord: Coord): void`), which are bivariant and unsafe to pass around detached
  from their object — exactly what a component does with them.
- **Fix.** Declared them as readonly arrow-function properties
  (`readonly onFire?: (coord: Coord) => void`), and moved shared non-component exports out
  of component files into `src/ui/labels.ts` to satisfy the Fast Refresh rule.
- **Verification.** `npm run lint` passes with no warnings.
