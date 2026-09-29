const { Pool } = require('pg');

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_MAX || '3', 10),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
};


/**
 * Execute a parameterized SQL query.
 * @param {string} text - SQL query string
 * @param {Array}  params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => getPool().query(text, params);

module.exports = { query, getPool };
