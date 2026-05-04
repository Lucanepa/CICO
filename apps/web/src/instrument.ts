import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN_WEB
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}
