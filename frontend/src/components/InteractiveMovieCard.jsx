import React from 'react';
import { Bookmark, BookmarkCheck, ThumbsUp, ThumbsDown } from 'lucide-react';
import PosterImage from './PosterImage';
import { useUserInteractions } from '../context/UserInteractionsContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (title = '') => {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

// Tint for the initials on posters that haven't loaded
const posterTints = ['text-fg-subtle', 'text-accent', 'text-brass', 'text-fg-muted'];

const getPosterColor = (id) => posterTints[Math.abs(id || 0) % posterTints.length];

// ── Main Component ───────────────────────────────────────────────────────────

const InteractiveMovieCard = ({
  movie,
  className = '',
  onClick,
  showScoreBar = false,
  onFeedback = null,
  rank = null,
  style,
}) => {
  const { watchlist, ratedMovies, toggleWatchlist, handleFeedback } = useUserInteractions();

  const id = movie.movieId || movie.movie_id;
  const tmdbId = movie.tmdbId || movie.tmdb_id;

  const inWatchlist = watchlist.has(id);
  const rated = ratedMovies.get(id);

  const score = movie.score != null ? Math.round(movie.score * 100) : null;
  const genres = movie.genres && typeof movie.genres === 'string'
    ? movie.genres.replace(/\|/g, ', ')
    : '';

  const handleFeedbackClick = (e, reward) => {
    e.stopPropagation();
    if (rated) return;

    handleFeedback(movie, reward);
    if (onFeedback) onFeedback(movie, reward);
  };

  const handleWatchlistClick = (e) => {
    e.stopPropagation();
    toggleWatchlist(movie);
  };

  const actionBase = 'flex-1 flex items-center justify-center h-control-sm rounded-xs border transition-colors duration-fast';

  return (
    <article className={`group flex flex-col min-w-0 ${className}`} style={style}>

      {/* Poster */}
      <div
        className="aspect-poster w-full relative cursor-pointer overflow-hidden rounded-sm border border-line group-hover:border-line-strong bg-surface transition-colors duration-base"
        onClick={onClick}
      >
        <PosterImage
          tmdbId={tmdbId}
          alt={movie.title}
          getPosterColor={getPosterColor}
          movieId={id}
          getInitials={getInitials}
        />

        {(rank != null || score != null) && (
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2xs p-xs z-raised pointer-events-none">
            {rank != null ? (
              <span className="font-mono text-micro text-on-image bg-scrim-solid px-2xs py-3xs rounded-xs tabular-nums">
                Nº{String(rank).padStart(2, '0')}
              </span>
            ) : <span />}
            {score != null && (
              <span className="font-mono text-micro font-medium text-brass-on-image bg-scrim-solid px-2xs py-3xs rounded-xs tabular-nums">
                {score}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info & Actions */}
      <div className="pt-xs flex flex-col flex-1 justify-between gap-xs">
        <div className="min-w-0">
          <h3
            className="text-small font-semibold text-fg truncate cursor-pointer hover:text-accent transition-colors duration-fast"
            title={movie.title}
            onClick={onClick}
          >
            {movie.title}
          </h3>
          <p className="font-mono text-micro text-fg-subtle truncate mt-3xs">
            {movie.year || '—'}
            {genres ? ` · ${genres}` : ''}
          </p>
        </div>

        {/* Optional Score bar */}
        {showScoreBar && score != null && (
          <div className="w-full h-rule bg-line overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-brass transition-all duration-slower ease-out"
              style={{ width: `${score}%` }}
            />
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center gap-2xs">
          <button
            onClick={handleWatchlistClick}
            className={`${actionBase} ${inWatchlist
              ? 'bg-accent border-accent text-accent-ink'
              : 'border-line text-fg-muted hover:text-fg hover:border-line-strong'
              }`}
            title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {inWatchlist ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>

          <button
            onClick={(e) => handleFeedbackClick(e, 1)}
            disabled={!!rated}
            className={`${actionBase} ${rated && rated >= 4
              ? 'bg-positive/15 border-positive/50 text-positive'
              : 'border-line text-fg-muted hover:text-positive hover:border-positive/50 disabled:opacity-disabled disabled:cursor-not-allowed'
              }`}
            title="Liked it"
          >
            <ThumbsUp size={14} />
          </button>

          <button
            onClick={(e) => handleFeedbackClick(e, 0)}
            disabled={!!rated}
            className={`${actionBase} ${rated && rated < 4
              ? 'bg-negative/15 border-negative/50 text-negative'
              : 'border-line text-fg-muted hover:text-negative hover:border-negative/50 disabled:opacity-disabled disabled:cursor-not-allowed'
              }`}
            title="Not for me"
          >
            <ThumbsDown size={14} />
          </button>
        </div>
      </div>
    </article>
  );
};

export default InteractiveMovieCard;
