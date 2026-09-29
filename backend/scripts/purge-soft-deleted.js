require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌  DATABASE_URL or DATABASE_URL_UNPOOLED must be set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const isConfirm = process.argv.includes('--confirm');

const run = async () => {
  try {
    const res = await pool.query('SELECT user_id, email, username FROM users WHERE is_deleted = TRUE');
    const users = res.rows;
    
    console.log(`Found ${users.length} soft-deleted user(s).`);
    users.forEach(u => console.log(` - ID: ${u.user_id}, Username: ${u.username}, Email: ${u.email}`));

    if (users.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    if (!isConfirm) {
      console.log('\n[DRY RUN] Run with --confirm to permanently hard-delete these users.');
      return;
    }

    console.log('\n[CONFIRMED] Hard-deleting users...');
    
    for (const u of users) {
      await pool.query('BEGIN');
      try {
        await pool.query('DELETE FROM user_ratings WHERE user_id = $1', [u.user_id]);
        await pool.query('DELETE FROM watchlist WHERE user_id = $1', [u.user_id]);
        await pool.query('DELETE FROM favourites WHERE user_id = $1', [u.user_id]);
        await pool.query('DELETE FROM user_preferences WHERE user_id = $1', [u.user_id]);
        await pool.query('DELETE FROM users WHERE user_id = $1', [u.user_id]);
        await pool.query('COMMIT');
        console.log(`✅ Deleted user ${u.user_id}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`❌ Failed to delete user ${u.user_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Database error:', err.message);
  } finally {
    pool.end();
  }
};

run();
