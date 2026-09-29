require('dotenv').config();
const { Pool } = require('pg');

const sql = `
  CREATE TABLE IF NOT EXISTS users (
    user_id       SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id     TEXT UNIQUE,
    avatar_url    TEXT,
    bio           TEXT,
    created_at    TIMESTAMP DEFAULT NOW(),
    is_deleted    BOOLEAN DEFAULT FALSE,
    deleted_at    TIMESTAMP,
    delete_after  TIMESTAMP
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS delete_after TIMESTAMP;

  CREATE TABLE IF NOT EXISTS user_ratings (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id   INTEGER NOT NULL REFERENCES movies(movie_id),
    rating     REAL NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, movie_id)
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id),
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, movie_id)
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
      user_id             INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      preferred_genres    TEXT[],
      favorite_languages  TEXT[],
      content_type        TEXT DEFAULT 'Movies',
      mood_preference     TEXT DEFAULT 'Light',
      runtime_preference  TEXT DEFAULT 'Medium',
      onboarding_complete BOOLEAN DEFAULT FALSE,
      updated_at          TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS favourites (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      movie_id   INTEGER NOT NULL REFERENCES movies(movie_id),
      added_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, movie_id)
  );
`;

const isPrint = process.argv.includes('--print');

if (isPrint) {
  console.log(sql);
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌  DATABASE_URL or DATABASE_URL_UNPOOLED must be set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

pool.query(sql)
  .then(() => {
    console.log('✅  Database tables initialised successfully');
    pool.end();
  })
  .catch(err => {
    console.error('❌  Failed to initialise tables:', err.message);
    pool.end();
    process.exit(1);
  });
