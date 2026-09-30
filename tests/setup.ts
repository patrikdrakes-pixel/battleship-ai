import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// The app persists preferences and the match record, so every test starts clean.
beforeEach(() => {
  localStorage.clear();
});
