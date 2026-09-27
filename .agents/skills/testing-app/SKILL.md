---
name: battleship-browser-testing
description: Deterministic browser verification of Battleship shot states, difficulty resets, and narrow layouts.
---

# Battleship browser testing

## Runtime

The app is a static React/Vite frontend with no backend or login. Run
`source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0` if Node is supplied by NVM.
Confirm localhost:5173 is reachable before starting a recording.

## Devin Secrets Needed

None.

## Reproducible gameplay

Use `?seed=<integer>&delay=0&difficulty=easy|medium|hard`.
Import `newGame` and `shipCells` from the engine when deterministic coordinates
are needed; derive the fixture again if fleet generation changes.
With seed 20260926, A1 is a miss, F1 is an unsunk Carrier hit, and F10/G10 sink
the Destroyer. Leaving B1 untouched puts all four visual states on one board.

Drive only actual UI actions. Audit enemy/player board shot counts using
`data-testid="enemy-board"`/`"player-board"` and `data-state="hit"`/`"miss"`.
Enemy buttons expose `data-cell`; own cells do not.
Wait for `data-testid="status"` to show Your turn before firing again.

## Difficulty lifecycle

The header selector has `data-testid="difficulty"`. Changing it resets the game;
New game retains the choice. Check both shot histories and the empty shot log.
Enemy fleet damage is deliberately hidden as AFLOAT until sunk; own counters
start at 0/5, 0/4, 0/3, 0/3, 0/2.
Use a nonzero delay to test reset before an AI timer finishes, then wait past
that deadline to ensure no stale reply enters the new game.

## Visual evidence

Capture actual pixels for untouched/miss/hit/sunk and inspect them together.
At narrow widths scroll to both fleets, checking all A-J columns and counters.
Record both innerWidth and document clientWidth: desktop Chromium scrollbars
can consume 15px. Require scrollWidth <= clientWidth.
Prefer viewport screenshots plus a scrolled lower screenshot for narrow layouts;
full-page captures can temporarily change scrollbar layout and crop the right
edge even when the live page fits. Recheck live bounds before reporting clipping.
