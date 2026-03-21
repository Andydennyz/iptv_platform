const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
const dbFromParts = process.env.DB_HOST
  ? `postgres://${encodeURIComponent(process.env.DB_USER || '')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || ''}`
  : undefined;

const pool = new Pool({
  connectionString: dbUrl || dbFromParts,
  ssl: (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
  max: Number(process.env.DB_CONN_LIMIT || 10),
});

module.exports = pool;
