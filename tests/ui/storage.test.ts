import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NO_PREFERENCES,
  NO_RECORD,
  loadPreferences,
  loadRecord,
  savePreferences,
  saveRecord,
} from '../../src/ui/storage';

describe('preferences storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a stored preference', () => {
    savePreferences({ difficulty: 'hard', muted: true });
    expect(loadPreferences()).toEqual({ difficulty: 'hard', muted: true });
  });

  it('falls back to defaults for missing, malformed or unknown values', () => {
    expect(loadPreferences()).toEqual(NO_PREFERENCES);

    localStorage.setItem('battleship.preferences', 'not json');
    expect(loadPreferences()).toEqual(NO_PREFERENCES);

    localStorage.setItem(
      'battleship.preferences',
      JSON.stringify({ difficulty: 'impossible', muted: 'yes' }),
    );
    expect(loadPreferences()).toEqual({ difficulty: null, muted: false });
  });

  it('round-trips a record and rejects impossible counters', () => {
    saveRecord({ wins: 3, losses: 1 });
    expect(loadRecord()).toEqual({ wins: 3, losses: 1 });

    localStorage.setItem('battleship.record', JSON.stringify({ wins: -2, losses: 1.5 }));
    expect(loadRecord()).toEqual(NO_RECORD);

    localStorage.setItem('battleship.record', JSON.stringify([1, 2]));
    expect(loadRecord()).toEqual(NO_RECORD);
  });

  it('stays silent when storage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => {
      saveRecord({ wins: 1, losses: 0 });
    }).not.toThrow();
    expect(loadRecord()).toEqual(NO_RECORD);
    expect(loadPreferences()).toEqual(NO_PREFERENCES);

    setItem.mockRestore();
    getItem.mockRestore();
  });
});
