const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const { query } = require('../db/neon');
const flask = require('../services/flaskService');
const { sendDeletionEmail } = require('../services/emailService');

const router = express.Router();

// All routes in this file are protected
router.use(authMiddleware);

// ─── GET /profile ────────────────────────────────────────────────────────────

router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      `SELECT user_id, username, email, google_id, avatar_url, bio, created_at
       FROM users WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /profile ────────────────────────────────────────────────────────────

router.put('/profile', async (req, res) => {
  try {
    const { username, bio, avatar_url, current_password, new_password } = req.body;

    if (current_password && new_password) {
      const userRes = await query(`SELECT password_hash FROM users WHERE user_id = $1`, [req.user.user_id]);
      if (userRes.rows.length > 0 && userRes.rows[0].password_hash) {
        const isValid = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
        if (!isValid) {
          return res.status(401).json({ error: 'Incorrect current password' });
        }
        const newHash = await bcrypt.hash(new_password, 10);
        await query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [newHash, req.user.user_id]);
      }
    }

    const result = await query(
      `UPDATE users
       SET username   = COALESCE($1, username),
           bio        = COALESCE($2, bio),
           avatar_url = COALESCE($3, avatar_url)
       WHERE user_id = $4
       RETURNING user_id, username, email, google_id, avatar_url, bio, created_at`,
      [username || null, bio || null, avatar_url || null, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Update profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RATINGS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /ratings ────────────────────────────────────────────────────────────

router.get('/ratings', async (req, res) => {
  try {
    const result = await query(
      `SELECT ur.id, ur.movie_id, ur.rating, ur.created_at,
              m.title, m.genres, m.year, m.tmdb_id
       FROM user_ratings ur
       JOIN movies m ON m.movie_id = ur.movie_id
       WHERE ur.user_id = $1
       ORDER BY ur.created_at DESC`,
      [req.user.user_id]
    );

    return res.json({ data: result.rows });
  } catch (err) {
    console.error('Get ratings error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /ratings (all) ───────────────────────────────────────────────────

router.delete('/ratings', async (req, res) => {
  try {
    await query('DELETE FROM user_ratings WHERE user_id = $1', [req.user.user_id]);
    return res.json({ status: 'reset' });
  } catch (err) {
    console.error('Reset ratings error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /ratings ───────────────────────────────────────────────────────────

router.post('/ratings', async (req, res) => {
  try {
    const { movie_id, rating } = req.body;

    if (movie_id == null || rating == null) {
      return res.status(400).json({ error: 'movie_id and rating are required' });
    }

    if (rating < 0.5 || rating > 5.0) {
      return res.status(400).json({ error: 'rating must be between 0.5 and 5.0' });
    }

    // Upsert rating
    await query(
      `INSERT INTO user_ratings (user_id, movie_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, movie_id)
       DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()`,
      [req.user.user_id, movie_id, rating]
    );

    // Send feedback to Flask bandit
    const reward = rating >= 4 ? 1 : 0;
    await flask.sendFeedback(movie_id, reward);

    return res.json({ status: 'saved' });
  } catch (err) {
    console.error('Post rating error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /ratings/:movieId ────────────────────────────────────────────────

router.delete('/ratings/:movieId', async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'Invalid movie ID' });
    }

    await query(
      'DELETE FROM user_ratings WHERE user_id = $1 AND movie_id = $2',
      [req.user.user_id, movieId]
    );

    return res.json({ status: 'deleted' });
  } catch (err) {
    console.error('Delete rating error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /watchlist ──────────────────────────────────────────────────────────

router.get('/watchlist', async (req, res) => {
  try {
    const result = await query(
      `SELECT w.id, w.movie_id, w.added_at,
              m.title, m.genres, m.year, m.tmdb_id
       FROM watchlist w
       JOIN movies m ON m.movie_id = w.movie_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [req.user.user_id]
    );

    return res.json({ data: result.rows });
  } catch (err) {
    console.error('Get watchlist error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /watchlist ─────────────────────────────────────────────────────────

router.post('/watchlist', async (req, res) => {
  try {
    const { movie_id } = req.body;

    if (movie_id == null) {
      return res.status(400).json({ error: 'movie_id is required' });
    }

    await query(
      `INSERT INTO watchlist (user_id, movie_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, movie_id) DO NOTHING`,
      [req.user.user_id, movie_id]
    );

    // Watchlisting = positive signal
    await flask.sendFeedback(movie_id, 1);

    return res.json({ status: 'added' });
  } catch (err) {
    console.error('Add to watchlist error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /watchlist/:movieId ──────────────────────────────────────────────

router.delete('/watchlist/:movieId', async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'Invalid movie ID' });
    }

    await query(
      'DELETE FROM watchlist WHERE user_id = $1 AND movie_id = $2',
      [req.user.user_id, movieId]
    );

    return res.json({ status: 'removed' });
  } catch (err) {
    console.error('Remove from watchlist error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAVOURITES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /favourites ─────────────────────────────────────────────────────────

router.get('/favourites', async (req, res) => {
  try {
    const result = await query(
      `SELECT f.id, f.movie_id, f.added_at,
              m.title, m.genres, m.year, m.tmdb_id
       FROM favourites f
       JOIN movies m ON m.movie_id = f.movie_id
       WHERE f.user_id = $1
       ORDER BY f.added_at DESC`,
      [req.user.user_id]
    );
    return res.json({ data: result.rows });
  } catch (err) {
    console.error('Get favourites error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /favourites ────────────────────────────────────────────────────────

router.post('/favourites', async (req, res) => {
  try {
    const { movie_id } = req.body;
    if (movie_id == null) return res.status(400).json({ error: 'movie_id is required' });

    await query(
      `INSERT INTO favourites (user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.user_id, movie_id]
    );

    await flask.sendFeedback(movie_id, 1);
    return res.json({ status: 'added' });
  } catch (err) {
    console.error('Add to favourites error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /favourites/:movieId ─────────────────────────────────────────────

router.delete('/favourites/:movieId', async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId, 10);
    if (isNaN(movieId)) return res.status(400).json({ error: 'Invalid movie ID' });
    await query('DELETE FROM favourites WHERE user_id = $1 AND movie_id = $2', [req.user.user_id, movieId]);
    return res.json({ status: 'removed' });
  } catch (err) {
    console.error('Remove from favourites error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREFERENCES & ACCOUNT
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /preferences ────────────────────────────────────────────────────────

router.get('/preferences', async (req, res) => {
  try {
    const result = await query(
      `SELECT preferred_genres, favorite_languages, content_type, mood_preference, runtime_preference, onboarding_complete
       FROM user_preferences WHERE user_id = $1`,
      [req.user.user_id]
    );
    if (result.rows.length === 0) {
      return res.json({
        data: {
          onboarding_complete: false,
          preferred_genres: [],
          favorite_languages: [],
          content_type: 'Movies',
          mood_preference: 'Light',
          runtime_preference: 'Medium'
        }
      });
    }
    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get preferences error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /preferences ───────────────────────────────────────────────────────

router.post('/preferences', async (req, res) => {
  try {
    const {
      preferred_genres, favorite_languages, content_type,
      mood_preference, runtime_preference, onboarding_complete
    } = req.body;

    const result = await query(
      `INSERT INTO user_preferences (
         user_id, preferred_genres, favorite_languages, content_type,
         mood_preference, runtime_preference, onboarding_complete, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_genres = EXCLUDED.preferred_genres,
         favorite_languages = EXCLUDED.favorite_languages,
         content_type = EXCLUDED.content_type,
         mood_preference = EXCLUDED.mood_preference,
         runtime_preference = EXCLUDED.runtime_preference,
         onboarding_complete = EXCLUDED.onboarding_complete,
         updated_at = NOW()
       RETURNING *`,
      [
        req.user.user_id, preferred_genres || [], favorite_languages || [],
        content_type || 'Movies', mood_preference || 'Light',
        runtime_preference || 'Medium', onboarding_complete || false
      ]
    );
    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Post preferences error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /profile ─────────────────────────────────────────────────────────

router.delete('/profile', async (req, res) => {
  const { getPool } = require('../db/neon');
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');

    // 1. Capture user info
    const userRes = await client.query(
      'SELECT username, email, avatar_url FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const { username, email, avatar_url } = userRes.rows[0];

    // 2. Delete related records
    await client.query('DELETE FROM user_ratings WHERE user_id = $1', [req.user.user_id]);
    await client.query('DELETE FROM watchlist WHERE user_id = $1', [req.user.user_id]);
    await client.query('DELETE FROM favourites WHERE user_id = $1', [req.user.user_id]);
    await client.query('DELETE FROM user_preferences WHERE user_id = $1', [req.user.user_id]);

    // 3. Delete user
    await client.query('DELETE FROM users WHERE user_id = $1', [req.user.user_id]);

    await client.query('COMMIT');

    // 4. Best-effort side effects
    const sideEffects = [];

    if (avatar_url && avatar_url.includes('cloudinary.com') &&
        process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const publicId = avatar_url.split('/').pop().split('.')[0];
      sideEffects.push(
        Promise.race([
          new Promise(resolve => setTimeout(resolve, 5000)),
          require('cloudinary').v2.uploader.destroy(publicId)
            .catch(e => console.error('Cloudinary delete error', e))
        ])
      );
    }

    sideEffects.push(
      Promise.race([
        new Promise(resolve => setTimeout(resolve, 5000)),
        sendDeletionEmail(email, username)
          .catch(e => console.error('Email error', e))
      ])
    );

    await Promise.allSettled(sideEffects);

    return res.json({ status: 'deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
