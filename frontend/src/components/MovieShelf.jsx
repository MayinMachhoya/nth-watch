import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ShelfMovieCard from './ShelfMovieCard'
import SortMenu from './SortMenu'
import useCardGrid from '../hooks/useCardGrid'

const SKELETON_COUNT = 12

const byTitle = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
const addedTime = (m) => new Date(m.added_at).getTime() || 0

const SORTS = [
  { key: 'recent', label: 'Recently added', compare: (a, b) => addedTime(b) - addedTime(a) },
  { key: 'title', label: 'Title A–Z', compare: byTitle },
  { key: 'year', label: 'Year (newest first)', compare: (a, b) => (b.year || 0) - (a.year || 0) || byTitle(a, b) },
]

const SkeletonCard = () => (
  <div aria-hidden="true">
    <div className="aspect-poster skeleton rounded-sm" />
    <div className="pt-xs space-y-xs">
      <div className="h-sm skeleton rounded-xs w-3/4" />
      <div className="h-xs skeleton rounded-xs w-1/2" />
    </div>
  </div>
)

// Shared page for the Watchlist / Favourites shelves.
const MovieShelf = ({
  index,
  eyebrow,
  title,
  subtitle,
  icon,
  items,
  loading,
  removeLabel,
  onRemove,
  cross,
  emptyTitle,
  emptyBody,
}) => {
  const Icon = icon
  const gridColsClass = useCardGrid()
  const [sortKey, setSortKey] = useState('recent')

  const sorted = useMemo(() => {
    const { compare } = SORTS.find((s) => s.key === sortKey) || SORTS[0]
    return [...items].sort(compare)
  }, [items, sortKey])

  const isEmpty = !loading && items.length === 0

  return (
    <div className="px-gutter py-xl animate-fade">
      <header className="grid lg:grid-cols-12 gap-md lg:gap-xl items-end border-b border-line pb-lg animate-rise">
        <div className="lg:col-span-8">
          <div className="label text-fg-subtle mb-sm">
            <span className="text-accent">{index}</span> / {eyebrow}
          </div>
          <h1 className="font-display text-display text-fg tracking-tightest">{title}</h1>
        </div>
        <p className="lg:col-span-4 text-body text-fg-muted">{subtitle}</p>
      </header>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center text-center min-h-empty-h py-3xl animate-rise stagger" style={{ '--i': 1 }}>
          <div className="flex items-center justify-center size-avatar-md rounded-full border border-line-strong text-accent mb-lg">
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <span className="label text-fg-subtle mb-sm"><span className="text-accent">00</span> / Nothing on the reel</span>
          <h2 className="font-display text-section text-fg tracking-tight mb-sm">{emptyTitle}</h2>
          <p className="text-body text-fg-muted max-w-form mb-xl">{emptyBody}</p>
          <Link
            to="/find"
            className="group inline-flex items-center gap-xs h-control-lg px-lg rounded-sm bg-accent text-accent-ink label font-semibold transition-all duration-fast hover:-translate-x-3xs hover:-translate-y-3xs hover:shadow-hard"
          >
            Discover films
            <ArrowRight size={14} className="transition-transform duration-fast group-hover:translate-x-2xs" />
          </Link>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-md py-md mb-lg border-b border-line animate-rise stagger" style={{ '--i': 1 }}>
            <span className="label text-fg-subtle tabular-nums" aria-live="polite">
              {loading ? 'Loading…' : (
                <>
                  <span className="text-accent">{String(items.length).padStart(2, '0')}</span>
                  {' '}{items.length === 1 ? 'title' : 'titles'}
                </>
              )}
            </span>
            <SortMenu options={SORTS} value={sortKey} onChange={setSortKey} />
          </div>

          {loading ? (
            <div className={`grid ${gridColsClass} gap-x-md gap-y-xl`} role="status" aria-label="Loading">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className={`grid ${gridColsClass} gap-x-md gap-y-xl`}>
              {sorted.map((movie, i) => (
                <ShelfMovieCard
                  key={movie.movie_id}
                  movie={movie}
                  style={{ '--i': i }}
                  className="animate-rise stagger"
                  removeLabel={removeLabel}
                  onRemove={onRemove}
                  cross={{
                    icon: cross.icon,
                    active: cross.ids.has(movie.movie_id),
                    onToggle: cross.onToggle,
                    addLabel: cross.addLabel,
                    removeLabel: cross.removeLabel,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MovieShelf
