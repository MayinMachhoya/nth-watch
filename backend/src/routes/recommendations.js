const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { query } = require('../db/neon');
const flask = require('../services/flaskService');

const router = express.Router();

// All routes in this file are protected
router.use(authMiddleware);

// ─── POST / ── Get personalised recommendations ─────────────────────────────

router.post('/', async (req, res) => {
  try {
    let { top_n = 10, genre_filter, mood_filter, runtime_filter, content_type } = req.body;
    const userId = req.user.user_id;

    const prefResult = await query(
      'SELECT preferred_genres, mood_preference, runtime_preference, content_type FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefResult.rows.length > 0) {
      const prefs = prefResult.rows[0];
      if (!genre_filter || genre_filter.length === 0) {
        genre_filter = prefs.preferred_genres?.length > 0 ? prefs.preferred_genres : null;
      }
      if (!mood_filter) {
        const moodMap = {
          'Light': ['Comedy', 'Romance', 'Animation'],
          'Dark': ['Drama', 'Thriller', 'Crime'],
          'Thriller-heavy': ['Thriller', 'Horror', 'Mystery'],
          'Comedy-heavy': ['Comedy', 'Animation', 'Children']
        };
        mood_filter = moodMap[prefs.mood_preference] || null;
      }
      if (!runtime_filter) {
        const runtimeMap = { 'Short': 90, 'Medium': 120, 'Long': 999 };
        runtime_filter = runtimeMap[prefs.runtime_preference] || null;
      }
      if (!content_type) {
        content_type = prefs.content_type || 'Movies';
      }
    }

    // Fetch the user's already-rated movie IDs so Flask can exclude them
    const ratingsResult = await query(
      'SELECT movie_id FROM user_ratings WHERE user_id = $1',
      [userId]
    );
    const seenMovieIds = ratingsResult.rows.map((r) => r.movie_id);

    const result = await flask.getRecommendations({
      user_id: userId,
      top_n,
      genre_filter,
      mood_filter,
      runtime_filter,
      content_type,
      seen_movie_ids: seenMovieIds,
    });

    if (!result) {
      return res.status(503).json({ error: 'Recommendation service unavailable' });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('Recommendations error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /feedback ──────────────────────────────────────────────────────────

router.post('/feedback', async (req, res) => {
  try {
    const { movie_id, reward } = req.body;

    if (movie_id == null || reward == null) {
      return res.status(400).json({ error: 'movie_id and reward are required' });
    }

    if (![0, 1].includes(reward)) {
      return res.status(400).json({ error: 'reward must be 0 or 1' });
    }

    // Forward to Flask bandit
    await flask.sendFeedback(movie_id, reward);

    // Also persist as a rating (reward=1 → 5.0, reward=0 → 1.0)
    const rating = reward === 1 ? 5.0 : 1.0;
    await query(
      `INSERT INTO user_ratings (user_id, movie_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, movie_id)
       DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()`,
      [req.user.user_id, movie_id, rating]
    );

    return res.json({ status: 'updated' });
  } catch (err) {
    console.error('Feedback error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
