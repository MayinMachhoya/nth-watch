import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import InteractiveMovieCard from './InteractiveMovieCard';
import SectionHeading from './SectionHeading';

const SKELETON_COUNT = 6;

const SkeletonCard = () => (
  <div className="shrink-0 w-rail-sm sm:w-rail" aria-hidden="true">
    <div className="aspect-poster skeleton rounded-sm" />
    <div className="pt-xs space-y-xs">
      <div className="h-sm skeleton rounded-xs w-3/4" />
      <div className="h-xs skeleton rounded-xs w-1/2" />
    </div>
  </div>
);

const arrowClass = 'flex items-center justify-center size-control-sm rounded-xs border border-line text-fg-muted hover:text-accent hover:border-accent transition-all duration-fast';

// Horizontal, arrow-scrollable row of movie cards under an editorial SectionHeading.
const MovieRail = ({ index, eyebrow, title, movies, loading, ranked = false, as = 'h2', className = '' }) => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [movies, updateScrollState]);

  // Scroll by most of a viewport-width of cards
  const scroll = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  return (
    <section className={className}>
      <SectionHeading
        index={index}
        eyebrow={eyebrow}
        as={as}
        title={title}
        action={!loading && movies.length > 0 && (
          <div className="hidden sm:flex items-center gap-2xs">
            <button
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              className={`${arrowClass} ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              className={`${arrowClass} ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      />

      <div ref={scrollRef} className="flex gap-md overflow-x-auto pb-xs no-scrollbar scroll-smooth snap-x">
        {loading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonCard key={i} />)
          : movies.map((movie, i) => {
            const id = movie.movieId || movie.movie_id;
            const tmdbId = movie.tmdbId || movie.tmdb_id;

            return (
              <InteractiveMovieCard
                key={id}
                movie={movie}
                rank={ranked ? i + 1 : null}
                onClick={() => navigate(`/movie/${tmdbId}`)}
                className="shrink-0 w-rail-sm sm:w-rail snap-start animate-rise stagger"
                style={{ '--i': i }}
              />
            );
          })}
      </div>
    </section>
  );
};

export default MovieRail;
