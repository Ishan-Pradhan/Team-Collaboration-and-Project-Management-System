import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { env, isProduction } from './env.js';

dotenv.config();

export const sequelize = new Sequelize(
  env.DB_NAME,
  env.DB_USER,
  env.DB_PASSWORD,
  {
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    dialect: 'postgres',
    logging: false,
    // Managed Postgres (Neon, Supabase, Render, ...) requires TLS and
    // presents a cert chain that fails default verification — local/Docker
    // Postgres has neither, so this only applies in production.
    dialectOptions: isProduction
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : undefined,
  },
);
