import { apiFetch } from '../context/AuthContext';
import { searchPeople as tmdbSearchPeople, getMovieDetails } from './tmdbService';
import { posterCache } from '../components/PosterImage';

// ── Movie search via backend (Flask TF-IDF) ──────────────────────────────────

export const searchMovies = async (query, topN, token, signal) => {
  const res = await apiFetch(
    `/api/movies/search?q=${encodeURIComponent(query)}&top_n=${topN}`,
    {},
    token,
    signal,
  );
  return res.data?.results || [];
};

// ── People search via TMDB ───────────────────────────────────────────────────

export const searchPeople = async (query, maxResults, signal) => {
  const results = await tmdbSearchPeople(query, signal);
  return (results || []).slice(0, maxResults);
};

// ── Batch-fetch posters for movie tmdbIds (shared posterCache) ────────────────

export const batchFetchPosters = async (tmdbIds) => {
  const missing = tmdbIds.filter(id => id && !posterCache.has(id));
  if (missing.length === 0) return;

  // Fetch in parallel (limit concurrency to 6)
  const chunks = [];
  for (let i = 0; i < missing.length; i += 6) {
    chunks.push(missing.slice(i, i + 6));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(id =>
        getMovieDetails(id)
          .then(data => {
            if (data?.poster_path) {
              posterCache.set(id, `https://image.tmdb.org/t/p/w500${data.poster_path}`);
            }
          })
          .catch(() => {}),
      ),
    );
  }
};
