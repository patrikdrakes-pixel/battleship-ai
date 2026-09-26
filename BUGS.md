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

## 2. `npm run build` failed once the E2E specs imported engine code

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

## 3. Three moderate advisories in the initial dependency tree

- **Symptom.** `npm install` reported `3 moderate severity vulnerabilities`, which would
  have failed the `npm audit --audit-level=moderate` CI job on the first push.
- **Root cause.** The scaffolded Vitest version depended on a vulnerable `@vitest/mocker`
  release.
- **Fix.** Upgraded `vitest` and `@vitest/coverage-v8` to `^5.0.1` (and the other dev
  tooling to current majors) and reinstalled.
- **Verification.** `npm audit` reports `found 0 vulnerabilities`; the CI `audit` job runs
  it on every pull request.

## 4. Unbound event handlers in the component props

- **Symptom.** `npm run lint` failed with `@typescript-eslint/unbound-method` in
  `App.tsx`, `Board.tsx`, `Cell.tsx` and `NewGameButton.tsx`.
- **Root cause.** The callback props were declared as TypeScript _method_ signatures
  (`onFire(coord: Coord): void`), which are bivariant and unsafe to pass around detached
  from their object — exactly what a component does with them.
- **Fix.** Declared them as readonly arrow-function properties
  (`readonly onFire?: (coord: Coord) => void`), and moved shared non-component exports out
  of component files into `src/ui/labels.ts` to satisfy the Fast Refresh rule.
- **Verification.** `npm run lint` passes with no warnings.
