import { defineConfig } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

// Match the development app's .env.local / .env precedence.
loadEnvConfig(process.cwd(), true);

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/mydb',
  },
  tablesFilter: ['!pg_stat_monitor*', '!pg_stat_statements*'],
});
