import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Film, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchMovies, searchPeople, batchFetchPosters } from '../services/searchService';
import { posterCache } from './PosterImage';

// ── Skeleton loaders ─────────────────────────────────────────────────────────

const MovieSkeleton = () => (
  <div className="flex items-center gap-sm px-md py-xs">
    <div className="w-thumb-w h-thumb-h rounded-xs skeleton shrink-0" />
    <div className="flex-1 space-y-xs">
      <div className="h-sm skeleton rounded-xs w-3/4" />
      <div className="h-xs skeleton rounded-xs w-1/2" />
    </div>
  </div>
);

const PersonSkeleton = () => (
  <div className="flex items-center gap-sm px-md py-xs">
    <div className="size-control rounded-full skeleton shrink-0" />
    <div className="flex-1 space-y-xs">
      <div className="h-sm skeleton rounded-xs w-2/3" />
      <div className="h-xs skeleton rounded-xs w-1/3" />
    </div>
  </div>
);

// ── Helper ───────────────────────────────────────────────────────────────────

const getInitials = (name = '') => {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

// ── Main Component ───────────────────────────────────────────────────────────

const SearchDropdown = ({ query, isOpen, onClose, onNavigate }) => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [movies, setMovies] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [posterUrls, setPosterUrls] = useState({});
  const abortRef = useRef(null);

  // Fetch results when query changes
  useEffect(() => {
    if (!query || query.length < 2 || !isOpen) {
      setMovies([]);
      setPeople([]);
      return;
    }

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    const fetchResults = async () => {
      try {
        const [movieResults, peopleResults] = await Promise.all([
          searchMovies(query, 5, token, controller.signal).catch(() => []),
          searchPeople(query, 4, controller.signal).catch(() => []),
        ]);

        if (controller.signal.aborted) return;

        setMovies(movieResults);
        setPeople(peopleResults);

        // Batch fetch posters for movies
        const tmdbIds = movieResults
          .map(m => m.tmdbId || m.tmdb_id)
          .filter(Boolean);

        if (tmdbIds.length > 0) {
          await batchFetchPosters(tmdbIds);
          // Build poster URL map from cache
          const urlMap = {};
          tmdbIds.forEach(id => {
            const cached = posterCache.get(id);
            if (cached) urlMap[id] = cached.replace('/w500/', '/w92/');
          });
          if (!controller.signal.aborted) setPosterUrls(urlMap);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Search error:', err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchResults();

    return () => controller.abort();
  }, [query, isOpen, token]);

  if (!isOpen || !query || query.length < 2) return null;

  const hasMovies = movies.length > 0;
  const hasPeople = people.length > 0;
  const isEmpty = !loading && !hasMovies && !hasPeople;

  const handleMovieClick = (movie) => {
    const tmdbId = movie.tmdbId || movie.tmdb_id;
    onClose();
    navigate(`/movie/${tmdbId}`);
  };

  const handlePersonClick = (person) => {
    onClose();
    navigate(`/person/${person.id}`);
  };

  const handleSeeAll = () => {
    onClose();
    onNavigate(query);
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-xs bg-surface-raised border border-line-strong rounded-sm shadow-lift overflow-hidden z-dropdown min-w-0 md:min-w-dropdown animate-fade">
      <div className="max-h-dropdown-h overflow-y-auto no-scrollbar">

        {/* Loading State */}
        {loading && (
          <div className="py-xs">
            <div className="flex items-center gap-xs px-md py-xs">
              <Loader2 size={12} className="text-accent animate-spin" />
              <span className="label text-fg-subtle">Searching</span>
            </div>
            <MovieSkeleton />
            <MovieSkeleton />
            <MovieSkeleton />
            <div className="h-px bg-line mx-md my-2xs" />
            <PersonSkeleton />
            <PersonSkeleton />
          </div>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-2xl px-md">
            <Search size={28} strokeWidth={1.5} className="text-fg-subtle mb-sm" />
            <p className="text-fg-muted text-small text-center">
              No results for “<span className="text-fg font-medium">{query}</span>”
            </p>
          </div>
        )}

        {/* Movie Results */}
        {!loading && hasMovies && (
          <div className="py-xs">
            <div className="flex items-center gap-xs px-md py-xs">
              <Film size={12} className="text-accent" />
              <span className="label text-fg-subtle">Films</span>
            </div>
            {movies.map((movie) => {
              const tmdbId = movie.tmdbId || movie.tmdb_id;
              const posterUrl = posterUrls[tmdbId];
              const genres = (movie.genres || '').split('|')[0];
              return (
                <button
                  key={movie.movieId || movie.movie_id}
                  onClick={() => handleMovieClick(movie)}
                  className="group flex items-center gap-sm w-full px-md py-xs text-left hover:bg-surface-hover transition-colors duration-fast"
                >
                  {/* Poster thumbnail */}
                  <div className="w-thumb-w h-thumb-h rounded-xs overflow-hidden poster-fallback shrink-0 flex items-center justify-center border border-line">
                    {posterUrl ? (
                      <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-small text-fg-subtle">{getInitials(movie.title)}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-small font-semibold text-fg truncate group-hover:text-accent transition-colors duration-fast">{movie.title}</p>
                    <p className="font-mono text-micro text-fg-subtle truncate">
                      {movie.year || '—'}
                      {genres ? ` · ${genres}` : ''}
                    </p>
                  </div>
                  {/* Match score */}
                  {movie.score != null && (
                    <span className="font-mono text-micro text-brass shrink-0 tabular-nums">
                      {Math.round(movie.score * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Separator */}
        {!loading && hasMovies && hasPeople && (
          <div className="h-px bg-line mx-md" />
        )}

        {/* People Results */}
        {!loading && hasPeople && (
          <div className="py-xs">
            <div className="flex items-center gap-xs px-md py-xs">
              <Users size={12} className="text-accent" />
              <span className="label text-fg-subtle">People</span>
            </div>
            {people.map((person) => {
              const photoUrl = person.profile_path
                ? `https://image.tmdb.org/t/p/w92${person.profile_path}`
                : null;
              const knownFor = person.known_for?.slice(0, 2).map(k => k.title || k.name).join(', ');
              return (
                <button
                  key={person.id}
                  onClick={() => handlePersonClick(person)}
                  className="group flex items-center gap-sm w-full px-md py-xs text-left hover:bg-surface-hover transition-colors duration-fast"
                >
                  {/* Profile photo */}
                  <div className="size-control rounded-full overflow-hidden poster-fallback shrink-0 flex items-center justify-center border border-line">
                    {photoUrl ? (
                      <img src={photoUrl} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-small text-fg-subtle">{getInitials(person.name)}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-small font-semibold text-fg truncate group-hover:text-accent transition-colors duration-fast">{person.name}</p>
                    <p className="text-caption text-fg-subtle truncate">
                      {person.known_for_department || 'Unknown'}
                      {knownFor ? ` · ${knownFor}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer: See all results */}
        {!loading && (hasMovies || hasPeople) && (
          <button
            onClick={handleSeeAll}
            className="group flex items-center justify-between w-full px-md py-sm border-t border-line text-small font-semibold text-fg hover:bg-accent hover:text-accent-ink transition-colors duration-fast"
          >
            See all results
            <ArrowRight size={14} className="transition-transform duration-fast group-hover:translate-x-2xs" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchDropdown;
