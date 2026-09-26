export interface Coord {
  readonly r: number;
  readonly c: number;
}

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export type Orientation = 'H' | 'V';

export interface Ship {
  readonly id: ShipId;
  readonly size: number;
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly hits: number;
}

export type CellState = 'empty' | 'ship' | 'hit' | 'miss';

export interface Board {
  readonly ships: readonly Ship[];
  /** 10x10 render source of truth. */
  readonly grid: readonly (readonly CellState[])[];
  /** Denormalized index: O(1) coord -> ship lookup. */
  readonly shipAt: readonly (readonly (ShipId | null)[])[];
}

export type ShotOutcome =
  | { readonly kind: 'miss' }
  | { readonly kind: 'hit'; readonly shipId: ShipId }
  | { readonly kind: 'sunk'; readonly shipId: ShipId; readonly size: number }
  /** Rejected input: the cell was already targeted. Never stored in history. */
  | { readonly kind: 'repeat' };

export interface Shot {
  readonly coord: Coord;
  readonly outcome: ShotOutcome;
}

export type Phase = 'playing' | 'playerWon' | 'aiWon';

export type Turn = 'player' | 'ai';

export interface GameState {
  /** The player's own fleet; the AI fires here. */
  readonly player: Board;
  /** The AI fleet, hidden from the player; the player fires here. */
  readonly ai: Board;
  readonly turn: Turn;
  readonly phase: Phase;
  readonly playerShots: readonly Shot[];
  readonly aiShots: readonly Shot[];
  readonly seed: number;
}
