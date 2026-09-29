import React, { useState, useEffect } from 'react';
import { apiFetch, useAuth } from '../context/AuthContext';
import MovieRail from './MovieRail';

// Content-based "more like this" rail for a local movie id.
// Renders nothing if the lookup fails or comes back empty.
const SimilarMoviesSlider = ({
  movieId,
  movieTitle,
  index = '04',
  eyebrow = 'If you liked this',
  title,
  topN = 11,
  as = 'h3',
  className = 'mt-3xl',
}) => {
  const { token } = useAuth();

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!movieId || !token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSimilar = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await apiFetch(`/api/movies/${movieId}/similar?top_n=${topN}`, {}, token);
        if (!cancelled) setMovies(res.data?.similar || []);
      } catch (err) {
        if (!cancelled) {
          console.error('Similar movies error:', err);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSimilar();
    return () => { cancelled = true; };
  }, [movieId, token, topN]);

  if (!loading && (error || movies.length === 0)) return null;

  return (
    <MovieRail
      index={index}
      eyebrow={eyebrow}
      title={title || <>More like <em className="text-accent">{movieTitle}</em></>}
      movies={movies}
      loading={loading}
      as={as}
      className={className}
    />
  );
};

export default SimilarMoviesSlider;
