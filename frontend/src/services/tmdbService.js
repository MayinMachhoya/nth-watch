const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchTmdb = async (endpoint, signal) => {
  if (!TMDB_API_KEY) {
    console.error('TMDB API Key missing in environment.');
    return null;
  }
  try {
    const divider = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`${BASE_URL}${endpoint}${divider}api_key=${TMDB_API_KEY}`, { signal });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err; // let callers handle abort
    console.error('TMDB fetch error:', err);
    return null;
  }
};

export const getMovieDetails = (tmdbId, signal) => fetchTmdb(`/movie/${tmdbId}`, signal);

export const getMovieCredits = (tmdbId) => fetchTmdb(`/movie/${tmdbId}/credits`);

export const getMovieImages = (tmdbId) => fetchTmdb(`/movie/${tmdbId}/images`);

export const getMovieRating = async (tmdbId) => {
  const data = await fetchTmdb(`/movie/${tmdbId}/release_dates`);
  if (!data?.results) return null;
  const usRelease = data.results.find(r => r.iso_3166_1 === 'US');
  if (!usRelease?.release_dates?.length) return null;
  const cert = usRelease.release_dates.find(d => d.certification);
  return cert ? cert.certification : null;
};

export const getPersonDetails = (personId) => fetchTmdb(`/person/${personId}`);

export const getPersonMovieCredits = (personId) => fetchTmdb(`/person/${personId}/movie_credits`);

export const searchPeople = async (query, signal) => {
  const data = await fetchTmdb(`/search/person?query=${encodeURIComponent(query)}&page=1`, signal);
  return data?.results || [];
};

export const getFullMovieData = async (tmdbId) => {
  const [details, credits, images, rating] = await Promise.all([
    getMovieDetails(tmdbId),
    getMovieCredits(tmdbId),
    getMovieImages(tmdbId),
    getMovieRating(tmdbId)
  ]);
  
  if (!details) return null;
  
  return {
    ...details,
    credits: credits || { cast: [], crew: [] },
    images: images || { backdrops: [], posters: [] },
    pgRating: rating
  };
};

// ── Home page ────────────────────────────────────────────────────────────────

export const getTrendingMovies = async () => {
  const data = await fetchTmdb('/trending/movie/week');
  return data?.results || [];
};

// TMDB genre id → name, for labelling trending results.
export const getMovieGenres = async () => {
  const data = await fetchTmdb('/genre/movie/list');
  return new Map((data?.genres || []).map((g) => [g.id, g.name]));
};

// The app's genre vocabulary (MovieLens, used in onboarding) → TMDB discover params.
// IMAX is a format, not a genre, so it has no TMDB equivalent.
const TMDB_GENRE_PARAMS = {
  Action: 'with_genres=28',
  Adventure: 'with_genres=12',
  Animation: 'with_genres=16',
  Children: 'with_genres=10751',
  Comedy: 'with_genres=35',
  Crime: 'with_genres=80',
  Documentary: 'with_genres=99',
  Drama: 'with_genres=18',
  Fantasy: 'with_genres=14',
  'Film-Noir': 'with_genres=80,9648&primary_release_date.lte=1959-12-31',
  Horror: 'with_genres=27',
  Musical: 'with_genres=10402',
  Mystery: 'with_genres=9648',
  Romance: 'with_genres=10749',
  'Sci-Fi': 'with_genres=878',
  Thriller: 'with_genres=53',
  War: 'with_genres=10752',
  Western: 'with_genres=37',
};

export const hasTmdbGenre = (genre) => genre in TMDB_GENRE_PARAMS;

// Top-rated films in a genre, restricted to titles with a large vote count so the
// list is both well-rated and widely seen. Returns TMDB results in rank order.
export const getTopRatedByGenre = async (genre, pages = 2) => {
  const params = TMDB_GENRE_PARAMS[genre];
  if (!params) return [];
  const minVotes = genre === 'Film-Noir' || genre === 'Documentary' ? 200 : 2000;
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetchTmdb(`/discover/movie?${params}&sort_by=vote_average.desc&vote_count.gte=${minVotes}&include_adult=false&page=${i + 1}`)
    )
  );
  return responses.flatMap((r) => r?.results || []);
};
