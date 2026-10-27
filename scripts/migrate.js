
import 'dotenv/config';
import { runner } from 'node-pg-migrate';

const requiredVariables = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

for (const name of requiredVariables) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const encode = (value) => encodeURIComponent(value);

const databaseUrl =
  `postgresql://${encode(process.env.DB_USER)}:` +
  `${encode(process.env.DB_PASSWORD)}@` +
  `${process.env.DB_HOST}:` +
  `${Number(process.env.DB_PORT || 5432)}/` +
  `${encode(process.env.DB_NAME)}`;

await runner({
  databaseUrl,
  dir: 'src/database/migrations',
  direction: 'up',
  migrationsTable: 'pgmigrations',
  ssl: process.env.DB_SSL === 'true',
});
