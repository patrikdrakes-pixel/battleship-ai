import { DIFFICULTIES } from '../engine/ai';
import type { Difficulty } from '../engine/types';

const PREFERENCES_KEY = 'battleship.preferences';
const RECORD_KEY = 'battleship.record';

export interface Preferences {
  readonly difficulty: Difficulty | null;
  readonly muted: boolean;
}

export interface MatchRecord {
  readonly wins: number;
  readonly losses: number;
}

export const NO_PREFERENCES: Preferences = { difficulty: null, muted: false };
export const NO_RECORD: MatchRecord = { wins: 0, losses: 0 };

/** Storage is best-effort: private modes and full quotas must not break the game. */
function read(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: preferences are a convenience, not state the game depends on.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

/** Anything unrecognised in storage is discarded rather than trusted. */
export function loadPreferences(): Preferences {
  const value = read(PREFERENCES_KEY);
  if (!isRecord(value)) return NO_PREFERENCES;
  const difficulty = DIFFICULTIES.find((known) => known === value.difficulty) ?? null;
  return { difficulty, muted: value.muted === true };
}

export function savePreferences(preferences: Preferences): void {
  write(PREFERENCES_KEY, preferences);
}

export function loadRecord(): MatchRecord {
  const value = read(RECORD_KEY);
  if (!isRecord(value)) return NO_RECORD;
  return { wins: asCount(value.wins), losses: asCount(value.losses) };
}

export function saveRecord(record: MatchRecord): void {
  write(RECORD_KEY, record);
}
