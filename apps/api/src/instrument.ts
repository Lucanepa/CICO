import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN_API
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}
