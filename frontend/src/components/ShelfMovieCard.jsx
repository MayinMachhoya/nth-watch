import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import PosterImage from './PosterImage';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (title = '') => {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const posterTints = ['text-fg-subtle', 'text-accent', 'text-brass', 'text-fg-muted'];

const getPosterColor = (id) => posterTints[Math.abs(id || 0) % posterTints.length];

const formatAdded = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Main Component ───────────────────────────────────────────────────────────

// Card for the Watchlist / Favourites shelves: poster with a hover-revealed trash
// button (remove from this shelf) and a medallion that toggles the other shelf.
const ShelfMovieCard = ({ movie, removeLabel, onRemove, cross, className = '', style }) => {
  const [leaving, setLeaving] = useState(false);

  const id = movie.movie_id;
  const tmdbId = movie.tmdb_id;
  const href = `/movie/${tmdbId}`;
  const genres = typeof movie.genres === 'string' ? movie.genres.replace(/\|/g, ', ') : '';
  const added = formatAdded(movie.added_at);

  const CrossIcon = cross.icon;
  const crossLabel = cross.active ? cross.removeLabel : cross.addLabel;

  const handleRemove = () => {
    setLeaving(true);
  };

  // Remove once the fade-out finishes so the grid reflows after the card is gone.
  const handleTransitionEnd = (e) => {
    if (leaving && e.target === e.currentTarget && e.propertyName === 'opacity') onRemove(movie);
  };

  const handleCross = () => cross.onToggle(movie);

  return (
    <article
      className={`group flex flex-col min-w-0 transition-all duration-base ease-out ${leaving ? 'opacity-0 scale-out pointer-events-none' : 'opacity-100'} ${className}`}
      style={style}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Poster */}
      <div className="aspect-poster w-full relative overflow-hidden rounded-sm border border-line group-hover:border-line-strong bg-surface transition-colors duration-base">
        <Link to={href} className="absolute inset-0 block" aria-label={movie.title}>
          <PosterImage
            tmdbId={tmdbId}
            alt={movie.title}
            getPosterColor={getPosterColor}
            movieId={id}
            getInitials={getInitials}
          />
        </Link>

        {/* Remove — revealed on hover / keyboard focus, always shown on touch */}
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-xs right-xs z-raised flex items-center justify-center size-control-sm rounded-xs bg-scrim-solid text-on-image opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 hover:text-negative transition-all duration-fast"
          title={removeLabel}
          aria-label={`${removeLabel}: ${movie.title}`}
        >
          <Trash2 size={14} />
        </button>

        {/* Cross-list medallion */}
        <button
          type="button"
          onClick={handleCross}
          aria-pressed={cross.active}
          className={`absolute bottom-xs right-xs z-raised flex items-center justify-center size-control rounded-full border transition-all duration-fast hover:scale-hover ${cross.active
            ? 'bg-accent border-accent text-accent-ink'
            : 'bg-scrim-solid border-line-strong text-on-image hover:border-accent hover:text-accent'
            }`}
          title={crossLabel}
          aria-label={`${crossLabel}: ${movie.title}`}
        >
          <CrossIcon size={16} fill={cross.active ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Info */}
      <Link to={href} tabIndex={-1} className="block pt-xs min-w-0">
        <h3 className="text-small font-semibold text-fg truncate group-hover:text-accent transition-colors duration-fast" title={movie.title}>
          {movie.title}
        </h3>
        <p className="font-mono text-micro text-fg-subtle truncate mt-3xs">
          {movie.year || '—'}
          {genres ? ` · ${genres}` : ''}
        </p>
        {added && (
          <p className="label text-fg-subtle truncate mt-xs pt-xs border-t border-line">
            <span className="text-accent">+</span> {added}
          </p>
        )}
      </Link>
    </article>
  );
};

export default ShelfMovieCard;
