import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

/** Only non-negative integers are accepted, so `?seed=` cannot inject anything. */
export function parseNumberParam(raw: string | null): number | undefined {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : undefined;
}

const params = new URLSearchParams(window.location.search);
const root = document.getElementById('root');
if (root === null) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App
      seed={parseNumberParam(params.get('seed'))}
      aiDelayMs={parseNumberParam(params.get('delay'))}
    />
  </StrictMode>,
);
