import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/*.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cico:changeme@localhost:5432/cico',
  },
  strict: true,
  verbose: true,
} satisfies Config
