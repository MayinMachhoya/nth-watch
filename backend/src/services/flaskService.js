const axios = require('axios');

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY) {
  throw new Error('INTERNAL_API_KEY is not set');
}

const FLASK_TIMEOUT_MS = parseInt(process.env.FLASK_TIMEOUT_MS || '45000', 10);

/**
 * Generic helper – all Flask calls go through here so we get
 * consistent error handling (return null on failure).
 */
const flaskRequest = async (method, path, data = null, params = null) => {
  try {
    const response = await axios({
      method,
      url: `${FLASK_URL}${path}`,
      data,
      params,
      headers: { 'X-Internal-Key': INTERNAL_API_KEY },
      timeout: FLASK_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    console.error(`Flask ${method.toUpperCase()} ${path} failed:`, err.message);
    return null;
  }
};

/**
 * POST /recommendations
 */
const getRecommendations = async ({
  user_id,
  top_n = 10,
  genre_filter = null,
  mood_filter = null,
  seen_movie_ids = [],
  cf_weight = 0.6,
  cb_weight = 0.4,
}) => {
  return flaskRequest('post', '/recommendations', {
    user_id,
    top_n,
    genre_filter,
    mood_filter,
    seen_movie_ids,
    cf_weight,
    cb_weight,
  });
};

/**
 * GET /similar/:movie_id?top_n=10
 */
const getSimilarMovies = async (movieId, topN = 10) => {
  return flaskRequest('get', `/similar/${movieId}`, null, { top_n: topN });
};

/**
 * GET /search?q=query&top_n=10
 */
const searchMovies = async (query, topN = 10) => {
  return flaskRequest('get', '/search', null, { q: query, top_n: topN });
};

/**
 * GET /popular?genre=Action&top_n=10
 */
const getPopularMovies = async (genre = null, topN = 10) => {
  const params = { top_n: topN };
  if (genre) params.genre = genre;
  return flaskRequest('get', '/popular', null, params);
};

/**
 * POST /feedback  { movie_id, reward }
 */
const sendFeedback = async (movieId, reward) => {
  return flaskRequest('post', '/feedback', { movie_id: movieId, reward });
};

module.exports = {
  getRecommendations,
  getSimilarMovies,
  searchMovies,
  getPopularMovies,
  sendFeedback,
};
