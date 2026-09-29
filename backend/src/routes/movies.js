const express = require('express');
const { query } = require('../db/neon');
const flask = require('../services/flaskService');

const router = express.Router();

router.get('/tmdb/:tmdbId', async (req, res) => {
  try {
    const tmdbId = parseInt(req.params.tmdbId, 10);
    if (isNaN(tmdbId)) return res.status(400).json({ error: 'Invalid TMDB ID' });

    const result = await query('SELECT * FROM movies WHERE tmdb_id = $1', [tmdbId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Movie not found locally' });
    const movie = result.rows[0];

    movie.inWatchlist = false;
    movie.inFavourites = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id || decoded.userId; // just in case

        const wRes = await query('SELECT 1 FROM watchlist WHERE user_id = $1 AND movie_id = $2', [userId, movie.movie_id]);
        if (wRes.rows.length > 0) movie.inWatchlist = true;

        const fRes = await query('SELECT 1 FROM favourites WHERE user_id = $1 AND movie_id = $2', [userId, movie.movie_id]);
        if (fRes.rows.length > 0) movie.inFavourites = true;
      } catch (err) { /* ignore invalid token */ }
    }

    return res.json({ data: movie });
  } catch (err) {
    console.error('TMDB movie error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/by-tmdb-ids', async (req, res) => {
  try {
    const { tmdb_ids } = req.body;
    if (!Array.isArray(tmdb_ids)) return res.status(400).json({ error: 'tmdb_ids must be array' });
    if (tmdb_ids.length === 0) return res.json({ data: [] });

    const result = await query('SELECT * FROM movies WHERE tmdb_id = ANY($1::int[])', [tmdb_ids]);
    return res.json({ data: result.rows });
  } catch (err) {
    console.error('by-tmdb-ids error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /search?q=query&top_n=10 ────────────────────────────────────────────

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const topN = parseInt(req.query.top_n, 10) || 10;

    if (!q) {
      return res.status(400).json({ error: 'q parameter is required' });
    }

    const result = await flask.searchMovies(q, topN);

    if (!result) {
      return res.status(503).json({ error: 'Recommendation service unavailable' });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('Movie search error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /popular?genre=Action&top_n=10 ──────────────────────────────────────

router.get('/popular', async (req, res) => {
  try {
    const genre = req.query.genre || null;
    const topN = parseInt(req.query.top_n, 10) || 10;

    const result = await flask.getPopularMovies(genre, topN);

    if (!result) {
      return res.status(503).json({ error: 'Recommendation service unavailable' });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('Popular movies error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /:movieId ───────────────────────────────────────────────────────────

router.get('/:movieId', async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'Invalid movie ID' });
    }

    const result = await query('SELECT * FROM movies WHERE movie_id = $1', [movieId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get movie error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /:movieId/similar?top_n=10 ──────────────────────────────────────────

router.get('/:movieId/similar', async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId, 10);
    const topN = parseInt(req.query.top_n, 10) || 10;

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'Invalid movie ID' });
    }

    const result = await flask.getSimilarMovies(movieId, topN);

    if (!result) {
      return res.status(503).json({ error: 'Recommendation service unavailable' });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('Similar movies error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
