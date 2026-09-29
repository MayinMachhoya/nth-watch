import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useUserInteractions } from '../context/UserInteractionsContext';
import InteractiveMovieCard from '../components/InteractiveMovieCard';
import PosterImage from '../components/PosterImage';
import LoadingSpinner from '../components/LoadingSpinner';
import SectionHeading from '../components/SectionHeading';
import useDocumentTitle from '../hooks/useDocumentTitle';
import {
  Tag,
  Zap,
  Coffee,
  Heart,
  Smile,
  Brain,
  Flame,
  Bookmark,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Sparkles,
  Film,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Children', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Fantasy', 'Film-Noir', 'Horror', 'IMAX',
  'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
];

const MOODS = [
  { key: 'Excited', icon: Zap, genres: ['Action', 'Adventure', 'Thriller'] },
  { key: 'Relaxed', icon: Coffee, genres: ['Comedy', 'Romance', 'Animation'] },
  { key: 'Emotional', icon: Heart, genres: ['Drama', 'Romance'] },
  { key: 'Fun', icon: Smile, genres: ['Comedy', 'Children', 'Animation'] },
  { key: 'Thoughtful', icon: Brain, genres: ['Drama', 'Mystery', 'Sci-Fi'] },
  { key: 'Thrilled', icon: Flame, genres: ['Horror', 'Thriller', 'Mystery'] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (title = '') => {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

// Tint for placeholder initials (modal thumbnail)
const posterColors = ['text-fg-subtle', 'text-accent', 'text-brass', 'text-fg-muted'];

const getPosterColor = (id) => posterColors[Math.abs(id || 0) % posterColors.length];

// ─── Sub-components ──────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div>
    <div className="aspect-poster skeleton rounded-sm" />
    <div className="pt-xs space-y-xs">
      <div className="h-sm skeleton rounded-xs w-3/4" />
      <div className="h-xs skeleton rounded-xs w-1/2" />
      <div className="h-rule skeleton w-full" />
      <div className="flex gap-2xs">
        <div className="h-control-sm flex-1 skeleton rounded-xs" />
        <div className="h-control-sm flex-1 skeleton rounded-xs" />
        <div className="h-control-sm flex-1 skeleton rounded-xs" />
      </div>
    </div>
  </div>
);

const SkeletonSimilar = () => (
  <div className="shrink-0 w-rail-sm sm:w-rail">
    <div className="aspect-poster skeleton rounded-sm" />
    <div className="pt-xs space-y-xs">
      <div className="h-sm skeleton rounded-xs w-3/4" />
      <div className="h-xs skeleton rounded-xs w-1/2" />
    </div>
  </div>
);

// Label column for a filter row: "01 / Genres"
const FilterLabel = ({ index, children, note }) => (
  <div className="md:col-span-2 flex md:flex-col items-baseline md:items-start gap-xs">
    <span className="label text-fg-subtle">
      <span className="text-accent">{index}</span> / {children}
    </span>
    {note && <span className="font-mono text-micro text-fg-subtle">{note}</span>}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const FindYourMovie = () => {
  const navigate = useNavigate();
  useDocumentTitle('Find Your Movie');
  const { token, user, logout } = useAuth();
  const { lastInteractedMovie, watchlist, toggleWatchlist } = useUserInteractions();

  // Data
  const [recommendations, setRecommendations] = useState([]);
  const [similarMovies, setSimilarMovies] = useState([]);

  // Filters
  const [selectedGenres, setSelectedGenres] = useState(new Set());
  const [selectedMood, setSelectedMood] = useState(null);

  // Interaction tracking (local animation layer)
  const [fadingCards, setFadingCards] = useState(new Set());

  // UI states
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalMovie, setModalMovie] = useState(null);

  // Refs
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const similarScrollRef = useRef(null);
  const prevFiltersRef = useRef('');

  // UI Preference
  const [cardSize, setCardSize] = useState('Comfortable');
  
  useEffect(() => {
    setCardSize(localStorage.getItem('cardSize') || 'Comfortable');
    
    // Listen for cross-tab or same-tab local storage changes if we wanted to
    const handleStorageChange = () => setCardSize(localStorage.getItem('cardSize') || 'Comfortable');
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  let gridColsClass = '';
  switch (cardSize) {
    case 'Compact':
      gridColsClass = 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'; // denser
      break;
    case 'Large':
      gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'; // larger
      break;
    case 'Comfortable':
    default:
      gridColsClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      break;
  }

  // ── Fetch recommendations ────────────────────────────────────────────────

  const fetchRecommendations = useCallback(
    async (genres, mood, retryCount = 0) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const filterKey = JSON.stringify({ genres: [...genres].sort(), mood });
      if (filterKey === prevFiltersRef.current && recommendations.length > 0 && retryCount === 0) return;
      if (retryCount === 0) prevFiltersRef.current = filterKey;

      setLoading(true);
      setError(null);

      const moodGenres = mood
        ? MOODS.find((m) => m.key === mood)?.genres || []
        : [];

      try {
        const res = await apiFetch(
          '/api/recommendations',
          {
            method: 'POST',
            body: JSON.stringify({
              top_n: 20,
              genre_filter: [...genres],
              mood_filter: moodGenres,
              cf_weight: 0.6,
              cb_weight: 0.4,
            }),
          },
          token,
          controller.signal
        );

        const recs = res.data?.recommendations || [];
        setRecommendations(recs);
        setLoading(false);
        setIsInitialLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (err.message === '__AUTH_EXPIRED__') { logout(); return; }

        // 503 — Flask down, fall back to popular movies
        if (err.status === 503) {
          if (retryCount < 3) {
            setError('Warming up the recommendation engine...');
            setTimeout(() => {
              if (abortRef.current && abortRef.current.signal.aborted) return;
              fetchRecommendations(genres, mood, retryCount + 1);
            }, 8000);
            return;
          }
          try {
            const pop = await apiFetch('/api/movies/popular?top_n=20', {}, token);
            const popular = pop.data?.popular || [];
            setRecommendations(popular);
            setError('Recommendation service temporarily unavailable. Showing popular movies instead.');
          } catch {
            setError('Failed to load movies. Please try again.');
          }
        } else {
          setError(err.message || 'Failed to load recommendations.');
        }
        setLoading(false);
        setIsInitialLoading(false);
      }
    },
    [token, logout, recommendations.length]
  );

  // ── Initial fetch + filter changes ───────────────────────────────────────

  useEffect(() => {
    if (!token || !user) return;
    // Reset prevFiltersRef so first fetch always runs
    prevFiltersRef.current = '';
    fetchRecommendations(selectedGenres, selectedMood);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Genre change (debounced 300ms)
  const handleGenreToggle = useCallback(
    (genre) => {
      setSelectedGenres((prev) => {
        const next = new Set(prev);
        if (next.has(genre)) next.delete(genre);
        else next.add(genre);

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          prevFiltersRef.current = '';
          fetchRecommendations(next, selectedMood);
        }, 300);

        return next;
      });
    },
    [fetchRecommendations, selectedMood]
  );

  // Mood change (immediate)
  const handleMoodToggle = useCallback(
    (moodKey) => {
      setSelectedMood((prev) => {
        const next = prev === moodKey ? null : moodKey;
        prevFiltersRef.current = '';
        fetchRecommendations(selectedGenres, next);
        return next;
      });
    },
    [fetchRecommendations, selectedGenres]
  );

  // ── Local Actions (Animation) ────────────────────────────────────────────

  const handleFeedbackAnimation = useCallback((movie) => {
    const movieId = movie.movieId || movie.movie_id;

    // Start fading
    setFadingCards((prev) => new Set(prev).add(movieId));

    // Remove card after 1.5s
    setTimeout(() => {
      setRecommendations((prev) =>
        prev.filter((m) => (m.movieId || m.movie_id) !== movieId)
      );
      setFadingCards((prev) => {
        const next = new Set(prev);
        next.delete(movieId);
        return next;
      });
    }, 1500);
  }, []);

  // ── Similar movies ──────────────────────────────────────────────────────

  const fetchSimilarMovies = useCallback(
    async (movieId) => {
      setSimilarLoading(true);
      try {
        const res = await apiFetch(
          `/api/movies/${movieId}/similar?top_n=10`,
          {},
          token
        );
        setSimilarMovies(res.data?.similar || []);
      } catch {
        setSimilarMovies([]);
      }
      setSimilarLoading(false);
    },
    [token]
  );

  useEffect(() => {
    if (lastInteractedMovie) {
      fetchSimilarMovies(lastInteractedMovie.movieId || lastInteractedMovie.movie_id);
    }
  }, [lastInteractedMovie, fetchSimilarMovies]);

  // ── Similar scroll helpers ───────────────────────────────────────────────

  const scrollSimilar = useCallback((dir) => {
    const el = similarScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
  }, []);

  // ── Modal: "Get recommendations like this" ──────────────────────────────

  const handleRecsLikeThis = useCallback(
    (movie) => {
      const movieGenres = (movie.genres || '').split('|').map((g) => g.trim()).filter(Boolean);
      setSelectedGenres(new Set(movieGenres));
      setSelectedMood(null);
      setModalMovie(null);
      prevFiltersRef.current = '';
      fetchRecommendations(new Set(movieGenres), null);
    },
    [fetchRecommendations]
  );

  // ── Retry ────────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    prevFiltersRef.current = '';
    fetchRecommendations(selectedGenres, selectedMood);
  }, [fetchRecommendations, selectedGenres, selectedMood]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (isInitialLoading) {
    return <LoadingSpinner text="Finding perfect movies for you..." />;
  }

  const arrowClass = 'flex items-center justify-center size-control-sm rounded-xs border border-line text-fg-muted hover:text-accent hover:border-accent transition-colors duration-fast';

  return (
    <div className="px-gutter py-xl space-y-2xl">
      {/* ═══ Page Header ═══ */}
      <header className="grid lg:grid-cols-12 gap-md lg:gap-xl items-end animate-rise">
        <div className="lg:col-span-8">
          <div className="label text-fg-subtle mb-sm">
            <span className="text-accent">Nº {String(recommendations.length).padStart(2, '0')}</span> / Picks on the reel
          </div>
          <h1 className="font-display text-display text-fg tracking-tightest">
            Find Your <em className="text-accent">Movie</em>
          </h1>
        </div>
        <p className="lg:col-span-4 text-body text-fg-muted">
          Personalised picks based on your taste. Narrow by genre, set a mood, and rate as you go to sharpen the list.
        </p>
      </header>

      {/* ═══ Section 1 — Filters ═══ */}
      <section className="border-y border-line divide-y divide-line">
        {/* Genre chips */}
        <div className="grid md:grid-cols-12 gap-sm md:gap-lg py-md">
          <FilterLabel index="01" note={selectedGenres.size > 0 ? `${selectedGenres.size} selected` : 'Any'}>Genres</FilterLabel>
          <div className="md:col-span-10 flex flex-wrap gap-xs">
            {GENRES.map((genre) => {
              const active = selectedGenres.has(genre);
              return (
                <button
                  key={genre}
                  onClick={() => handleGenreToggle(genre)}
                  aria-pressed={active}
                  className={`px-sm h-control-sm rounded-xs text-small font-medium transition-colors duration-fast border ${active
                    ? 'bg-accent border-accent text-accent-ink'
                    : 'bg-transparent border-line text-fg-muted hover:border-line-strong hover:text-fg'
                    }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mood selector */}
        <div className="grid md:grid-cols-12 gap-sm md:gap-lg py-md">
          <FilterLabel index="02" note={selectedMood || 'Any'}>Mood</FilterLabel>
          <div className="md:col-span-10 grid grid-cols-3 sm:grid-cols-6 gap-xs">
            {/* eslint-disable-next-line no-unused-vars */}
            {MOODS.map(({ key, icon: Icon }) => {
              const active = selectedMood === key;
              return (
                <button
                  key={key}
                  onClick={() => handleMoodToggle(key)}
                  aria-pressed={active}
                  className={`group flex items-center justify-center sm:justify-start gap-xs px-sm h-control rounded-xs text-small font-medium transition-colors duration-fast border ${active
                    ? 'bg-accent-wash border-accent text-fg'
                    : 'bg-surface border-line text-fg-muted hover:border-line-strong hover:text-fg'
                    }`}
                >
                  <Icon size={16} strokeWidth={1.75} className={active ? 'text-accent' : 'text-fg-subtle group-hover:text-fg-muted'} />
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Section 2 — Recommendations Grid ═══ */}
      <section>
        <SectionHeading
          index="03"
          eyebrow="Ranked by match"
          title="Recommended for you"
          action={!loading && recommendations.length > 0 && (
            <span className="hidden sm:inline font-mono text-micro text-fg-subtle">{recommendations.length} titles</span>
          )}
        />

        {/* Error with retry */}
        {error && (
          <div className="flex items-center gap-sm bg-surface border border-line border-l-rule border-l-brass rounded-xs px-md py-sm mb-lg">
            <AlertTriangle size={16} className="text-brass shrink-0" />
            <span className="text-small text-fg-muted flex-1">{error}</span>
            {!error.includes('Showing popular') && !error.includes('Warming up') && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-2xs label text-accent hover:text-fg transition-colors duration-fast"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Loading skeletons */}
        {loading ? (
          <div className={`grid ${gridColsClass} gap-x-md gap-y-xl`}>
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recommendations.length === 0 && !error ? (
          /* Empty state */
          <div className="flex flex-col items-start py-3xl">
            <span className="label text-fg-subtle mb-sm"><span className="text-accent">00</span> / Nothing on the reel</span>
            <p className="font-display text-section text-fg">
              No recommendations found. Try changing your filters.
            </p>
          </div>
        ) : (
          /* Movie grid */
          <div data-rec-grid className={`grid ${gridColsClass} gap-x-md gap-y-xl`}>
            {recommendations.map((movie, i) => {
              const id = movie.movieId || movie.movie_id;
              const isFading = fadingCards.has(id);

              return (
                <InteractiveMovieCard
                  key={id}
                  movie={movie}
                  rank={i + 1}
                  style={{ '--i': i }}
                  className={`animate-rise stagger transition-all duration-slow ease-out ${isFading ? 'opacity-0 scale-out -translate-y-md pointer-events-none' : 'opacity-100'}`}
                  showScoreBar={true}
                  onClick={() => navigate(`/movie/${(movie.tmdbId || movie.tmdb_id)}`)}
                  onFeedback={handleFeedbackAnimation}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ Section 3 — Similar Movies Row ═══ */}
      {lastInteractedMovie && (
        <section>
          <SectionHeading
            index="04"
            eyebrow="From your last rating"
            title={<>Because you liked <em className="text-accent">{lastInteractedMovie.title}</em></>}
            action={
              <div className="hidden sm:flex items-center gap-2xs">
                <button onClick={() => scrollSimilar(-1)} className={arrowClass} aria-label="Scroll left">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => scrollSimilar(1)} className={arrowClass} aria-label="Scroll right">
                  <ChevronRight size={16} />
                </button>
              </div>
            }
          />

          <div
            ref={similarScrollRef}
            className="flex gap-md overflow-x-auto pb-xs no-scrollbar"
          >
            {similarLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonSimilar key={i} />)
              : similarMovies.map((movie, i) => {
                const id = movie.movieId || movie.movie_id;
                return (
                  <InteractiveMovieCard
                    key={id}
                    movie={movie}
                    style={{ '--i': i }}
                    className="shrink-0 w-rail-sm sm:w-rail animate-rise stagger"
                    onClick={() => {
                      setModalMovie(null);
                      navigate(`/movie/${(movie.tmdbId || movie.tmdb_id)}`);
                    }}
                  />
                );
              })}
          </div>
        </section>
      )}

      {/* ═══ Modal — Similar Movie Detail ═══ */}
      {modalMovie && (
        <div
          className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-scrim animate-fade"
          onClick={() => setModalMovie(null)}
        >
          <div
            className="bg-surface-raised border border-line-strong rounded-t-md sm:rounded-md w-full sm:max-w-modal p-lg space-y-md relative transition-colors duration-base animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalMovie(null)}
              className="absolute top-md right-md flex items-center justify-center size-control-sm rounded-xs text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors duration-fast"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex gap-md">
              <div className="w-avatar-md aspect-poster rounded-xs poster-fallback border border-line flex items-center justify-center shrink-0">
                <span className={`font-display text-title ${getPosterColor(modalMovie.movieId || modalMovie.movie_id)}`}>
                  {getInitials(modalMovie.title)}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-title text-fg truncate">{modalMovie.title}</h3>
                <p className="font-mono text-micro text-fg-subtle mt-2xs">{modalMovie.year || '—'}</p>
                <p className="text-caption text-fg-muted mt-2xs truncate">
                  {modalMovie.genres ? modalMovie.genres.replace(/\|/g, ', ') : '—'}
                </p>
                {modalMovie.score != null && (
                  <p className="font-mono text-micro text-brass mt-2xs">
                    {Math.round(modalMovie.score * 100)}% match
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <button
                onClick={() => {
                  toggleWatchlist(modalMovie);
                  setModalMovie(null);
                }}
                className="flex items-center justify-center gap-xs w-full h-control rounded-sm bg-accent text-accent-ink text-small font-semibold hover:bg-accent-strong transition-colors duration-fast"
              >
                <Bookmark size={16} />
                {watchlist.has(modalMovie.movieId || modalMovie.movie_id)
                  ? 'Remove from Watchlist'
                  : 'Add to Watchlist'}
              </button>
              <button
                onClick={() => handleRecsLikeThis(modalMovie)}
                className="flex items-center justify-center gap-xs w-full h-control rounded-sm border border-line-strong text-fg text-small font-medium hover:border-accent hover:text-accent transition-colors duration-fast"
              >
                <Sparkles size={16} />
                Get recommendations like this
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindYourMovie;
