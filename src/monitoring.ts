import * as Sentry from '@sentry/react';

export function initMonitoring(dsn?: string): void {
  const configuredDsn: unknown = dsn ?? import.meta.env.VITE_SENTRY_DSN;
  const environment: unknown =
    import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
  if (typeof configuredDsn !== 'string' || configuredDsn === '') return;

  Sentry.init({
    dsn: configuredDsn,
    environment: typeof environment === 'string' ? environment : undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}
