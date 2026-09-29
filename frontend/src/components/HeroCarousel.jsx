import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMovieGenres, getTrendingMovies } from '../services/tmdbService';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useUserInteractions } from '../context/UserInteractionsContext';
import HeroBanner from './HeroBanner';

const SLIDE_COUNT = 5;
const SWIPE_THRESHOLD = 48; // px of horizontal travel that counts as a swipe

// Viewfinder crop marks for the hero corners
const CropMark = ({ className }) => (
  <span className={`absolute size-md border-line-strong pointer-events-none ${className}`} aria-hidden="true" />
);

const pad = (n) => String(n).padStart(2, '0');

const loadSlides = async () => {
  const [trending, genreNames] = await Promise.all([getTrendingMovies(), getMovieGenres()]);

  const slides = trending
    .filter((m) => m.backdrop_path)
    .slice(0, SLIDE_COUNT)
    .map((m) => ({
      tmdbId: m.id,
      title: m.title,
      overview: m.overview,
      year: m.release_date ? m.release_date.substring(0, 4) : null,
      rating: m.vote_average ? (m.vote_average / 2).toFixed(1) : null,
      genres: (m.genre_ids || []).map((id) => genreNames.get(id)).filter(Boolean).slice(0, 3),
      backdrop: `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`,
    }));

  // Attach the local catalogue row where one exists, so the watchlist button can work.
  try {
    const res = await apiFetch('/api/movies/by-tmdb-ids', {
      method: 'POST',
      body: JSON.stringify({ tmdb_ids: slides.map((s) => s.tmdbId) }),
    });
    const local = new Map((res.data || []).map((m) => [m.tmdb_id, m]));
    return slides.map((s) => ({ ...s, local: local.get(s.tmdbId) || null }));
  } catch {
    return slides;
  }
};

// Auto-rotating hero of this week's trending films (TMDB). The slide timer is the
// active indicator's CSS progress animation: it pauses on hover/focus (index.css)
// and its animationend advances the slide. Falls back to the static banner if
// TMDB can't be reached.
const HeroCarousel = () => {
  const { isAuthenticated } = useAuth();
  const { watchlist, toggleWatchlist } = useUserInteractions();

  const [slides, setSlides] = useState(null); // null = loading
  const [active, setActive] = useState(0);
  const touchX = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadSlides()
      .then((s) => { if (!cancelled) setSlides(s); })
      .catch(() => { if (!cancelled) setSlides([]); });
    return () => { cancelled = true; };
  }, []);

  const count = slides?.length || 0;
  const go = useCallback((i) => setActive(((i % count) + count) % count), [count]);
  const next = useCallback(() => go(active + 1), [go, active]);
  const prev = useCallback(() => go(active - 1), [go, active]);

  const handleTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx < 0 ? next : prev)();
  };

  const frameClass = 'relative w-full h-hero rounded-sm overflow-hidden border border-line bg-ink';

  if (slides === null) {
    return (
      <div className="px-gutter pt-lg pb-xl">
        <div className={`theme-dark ${frameClass} skeleton`} role="status" aria-label="Loading trending films" />
      </div>
    );
  }

  if (count === 0) return <HeroBanner />;

  const slide = slides[active];
  const localId = slide.local?.movie_id;
  const inWatchlist = localId != null && watchlist.has(localId);

  const ctrlClass = 'flex items-center justify-center size-control-sm rounded-xs border border-line-strong text-fg-muted hover:text-accent hover:border-accent transition-colors duration-fast';

  return (
    <div className="px-gutter pt-lg pb-xl">
      {/* theme-dark: the overlay (and the type on it) stay dark in light mode too */}
      <section
        className={`theme-dark carousel group ${frameClass}`}
        aria-roledescription="carousel"
        aria-label="Trending this week"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Backdrops — stacked and cross-faded */}
        {slides.map((s, i) => (
          <img
            key={s.tmdbId}
            src={s.backdrop}
            alt=""
            aria-hidden="true"
            loading={i === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-slower ease-out ${i === active ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}

        {/* Fade into the page */}
        <div className="absolute inset-0 fade-to-ink-r" />
        <div className="absolute inset-0 fade-to-ink-b" />

        <CropMark className="top-md left-md border-t border-l" />
        <CropMark className="top-md right-md border-t border-r" />
        <CropMark className="bottom-md left-md border-b border-l" />
        <CropMark className="bottom-md right-md border-b border-r" />

        {/* Slide content — keyed so it re-runs the rise-in on every change */}
        <div
          key={slide.tmdbId}
          className="absolute inset-0 flex flex-col justify-end px-lg sm:px-2xl pb-3xl sm:pb-2xl w-full lg:w-2/3"
          role="group"
          aria-roledescription="slide"
          aria-label={`${active + 1} of ${count}: ${slide.title}`}
        >
          <div className="label text-fg-muted mb-sm animate-rise">
            <span className="text-accent">Nº {pad(active + 1)}</span> / Trending this week
          </div>

          <h2 className="font-display italic text-display text-fg tracking-tightest mb-md line-clamp-2 animate-rise stagger" style={{ '--i': 1 }}>
            {slide.title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs mb-md font-mono text-caption text-fg-muted animate-rise stagger" style={{ '--i': 2 }}>
            {slide.rating && (
              <span className="flex items-center gap-2xs">
                <span className="text-brass" aria-hidden="true">★</span>
                <span className="text-fg">{slide.rating}</span>
                <span className="text-fg-subtle">/5</span>
              </span>
            )}
            {[slide.year, ...slide.genres].filter(Boolean).map((item) => (
              <span key={item} className="inline-flex items-center gap-sm whitespace-nowrap">
                <span className="text-fg-subtle">/</span>
                {item}
              </span>
            ))}
          </div>

          {slide.overview && (
            <p className="hidden sm:block text-body text-fg-muted max-w-prose mb-lg line-clamp-2 animate-rise stagger" style={{ '--i': 3 }}>
              {slide.overview}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-sm animate-rise stagger" style={{ '--i': 4 }}>
            <Link
              to={`/movie/${slide.tmdbId}`}
              className="group/cta flex items-center gap-xs bg-accent text-accent-ink px-lg h-control-lg rounded-sm font-semibold text-body transition-all duration-fast hover:-translate-x-3xs hover:-translate-y-3xs hover:shadow-hard"
            >
              View details
              <ArrowRight size={18} className="transition-transform duration-fast group-hover/cta:translate-x-2xs" />
            </Link>
            {isAuthenticated && localId != null && (
              <button
                type="button"
                onClick={() => toggleWatchlist(slide.local)}
                aria-pressed={inWatchlist}
                className={`flex items-center gap-xs px-lg h-control-lg rounded-sm border font-medium text-body transition-colors duration-fast ${inWatchlist
                  ? 'border-accent text-accent'
                  : 'border-line-strong text-fg hover:border-accent hover:text-accent'
                  }`}
              >
                {inWatchlist ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                {inWatchlist ? 'In Watchlist' : 'Watchlist'}
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="absolute right-lg sm:right-2xl bottom-md sm:bottom-2xl z-raised flex items-center gap-sm">
          <ol className="flex items-center gap-xs">
            {slides.map((s, i) => {
              const isActive = i === active;
              return (
                <li key={s.tmdbId}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Show slide ${i + 1}: ${s.title}`}
                    aria-current={isActive}
                    className={`flex flex-col gap-2xs py-2xs font-mono text-micro tabular-nums transition-colors duration-fast ${isActive ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted'}`}
                  >
                    {pad(i + 1)}
                    <span className="relative block w-lg h-rule bg-line-strong overflow-hidden">
                      {isActive && (
                        <span
                          key={active}
                          className="carousel-progress absolute inset-0 origin-left bg-accent animate-progress"
                          onAnimationEnd={next}
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="hidden sm:flex items-center gap-2xs">
            <button type="button" onClick={prev} className={ctrlClass} aria-label="Previous slide">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={next} className={ctrlClass} aria-label="Next slide">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HeroCarousel;
