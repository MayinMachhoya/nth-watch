import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Heart } from 'lucide-react'
import HeroCarousel from '../components/HeroCarousel'
import MovieRail from '../components/MovieRail'
import SimilarMoviesSlider from '../components/SimilarMoviesSlider'
import { apiFetch, useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { useUserInteractions } from '../context/UserInteractionsContext'
import { getTopRatedByGenre, hasTmdbGenre } from '../services/tmdbService'
import useDocumentTitle from '../hooks/useDocumentTitle'

const MAX_GENRE_ROWS = 3
const RAIL_LENGTH = 15

const STEPS = [
  {
    title: 'Tell us your taste',
    body: 'Pick the genres, languages and moods you gravitate to. It takes about thirty seconds.',
  },
  {
    title: 'Rate as you go',
    body: 'A thumbs up or down on any pick feeds straight back into the engine, so every rating sharpens the next list.',
  },
  {
    title: 'Get your next watch',
    body: 'Collaborative filtering and content matching, blended and re-ranked for the genre or mood you want tonight.',
  },
]

const pad = (n) => String(n).padStart(2, '0')

// ── Genre rail ───────────────────────────────────────────────────────────────

// Session cache of in-flight/finished lookups, so returning to Home (or a double
// mount) doesn't refetch every rail. Failed lookups are evicted to allow a retry.
const genreCache = new Map()

// TMDB's top-rated titles for a genre, kept in TMDB order and narrowed to films in
// the local catalogue (so the card's watchlist / rating actions have a movie_id).
const fetchGenreRail = async (genre) => {
  const ranked = await getTopRatedByGenre(genre)
  if (ranked.length === 0) return []

  const res = await apiFetch('/api/movies/by-tmdb-ids', {
    method: 'POST',
    body: JSON.stringify({ tmdb_ids: ranked.map((m) => m.id) }),
  })
  const local = new Map((res.data || []).map((m) => [m.tmdb_id, m]))
  return ranked
    .map((m) => local.get(m.id))
    .filter(Boolean)
    .slice(0, RAIL_LENGTH)
}

const loadGenreRail = (genre) => {
  if (!genreCache.has(genre)) {
    genreCache.set(genre, fetchGenreRail(genre).catch((err) => {
      genreCache.delete(genre)
      throw err
    }))
  }
  return genreCache.get(genre)
}

const GenreRail = ({ genre, index }) => {
  const [movies, setMovies] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadGenreRail(genre)
      .then((m) => { if (!cancelled) setMovies(m) })
      .catch((err) => {
        console.error(`Genre rail (${genre}) failed:`, err)
        if (!cancelled) setMovies([])
      })
    return () => { cancelled = true }
  }, [genre])

  if (movies && movies.length === 0) return null

  return (
    <MovieRail
      index={pad(index)}
      eyebrow={`Top rated · ${genre}`}
      title={<>Most popular in <em className="text-accent">{genre}</em></>}
      movies={movies || []}
      loading={movies === null}
      ranked
    />
  )
}

// ── Sections ─────────────────────────────────────────────────────────────────

const BecauseYouLiked = ({ index }) => {
  const { lastLikedMovie, listsLoading } = useUserInteractions()

  if (listsLoading) return null

  if (!lastLikedMovie) {
    return (
      <section className="grid md:grid-cols-12 gap-md md:gap-lg items-center border-t border-b border-line py-xl">
        <div className="md:col-span-1 flex items-center justify-center size-control-lg rounded-full border border-line-strong text-accent">
          <Heart size={18} strokeWidth={1.75} />
        </div>
        <div className="md:col-span-8">
          <div className="label text-fg-subtle mb-xs"><span className="text-accent">{pad(index)}</span> / Because you liked</div>
          <p className="font-display text-section text-fg tracking-tight">Nothing liked yet.</p>
          <p className="text-body text-fg-muted max-w-prose mt-2xs">
            Give a film a thumbs up and this row will fill with more like it, and it&apos;ll still be here next time you sign in.
          </p>
        </div>
        <Link
          to="/find"
          className="md:col-span-3 md:justify-self-end group inline-flex items-center gap-xs label text-accent hover:text-fg transition-colors duration-fast"
        >
          Start rating
          <ArrowRight size={14} className="transition-transform duration-fast group-hover:translate-x-2xs" />
        </Link>
      </section>
    )
  }

  const { movie_id, tmdb_id, title } = lastLikedMovie
  const titleNode = tmdb_id
    ? <Link to={`/movie/${tmdb_id}`} className="text-accent italic hover:underline underline-offset-4">{title}</Link>
    : <em className="text-accent">{title}</em>

  return (
    <SimilarMoviesSlider
      key={movie_id}
      movieId={movie_id}
      index={pad(index)}
      eyebrow="From your last like"
      title={<>Because you liked {titleNode} recently</>}
      as="h2"
      className=""
    />
  )
}

const GuestIntro = () => (
  <section className="px-gutter pb-3xl">
    <div className="grid lg:grid-cols-12 gap-xl lg:gap-2xl border-t border-line pt-xl">
      <h2 className="lg:col-span-7 font-display text-display text-fg tracking-tightest">
        Every great film is somebody&apos;s <em className="text-accent">nth</em> watch.
      </h2>

      <div className="lg:col-span-5 flex flex-col justify-end gap-lg">
        <p className="text-lead text-fg-muted max-w-prose">
          Nth Watch learns what you actually enjoy and lines up films worth pressing play on,
          whether it&apos;s your first viewing or your fifteenth.
        </p>
        <div className="flex flex-wrap gap-sm">
          <Link
            to="/register"
            className="group flex items-center gap-xs bg-fg text-ink px-lg h-control-lg rounded-sm font-semibold text-body transition-colors duration-fast hover:bg-accent hover:text-accent-ink"
          >
            Create an account
            <ArrowRight size={18} className="transition-transform duration-fast group-hover:translate-x-2xs" />
          </Link>
          <Link
            to="/login"
            className="flex items-center px-lg h-control-lg rounded-sm border border-line-strong text-fg font-medium text-body transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>

    <ol className="grid md:grid-cols-3 gap-lg md:gap-xl mt-3xl">
      {STEPS.map((step, i) => (
        <li key={step.title} className="border-t border-line-strong pt-md">
          <div className="flex items-baseline gap-sm mb-sm">
            <span className="font-mono text-micro text-accent tabular-nums">{pad(i + 1)}</span>
            <h3 className="font-display text-title text-fg">{step.title}</h3>
          </div>
          <p className="text-small text-fg-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  </section>
)

// ── Page ─────────────────────────────────────────────────────────────────────

const Home = () => {
  useDocumentTitle()
  const { isAuthenticated } = useAuth()
  const { preferences } = usePreferences()

  const genres = (preferences?.preferred_genres || []).filter(hasTmdbGenre).slice(0, MAX_GENRE_ROWS)

  return (
    <div>
      <HeroCarousel />

      {isAuthenticated ? (
        <div className="px-gutter pb-3xl flex flex-col gap-3xl">
          {genres.map((genre, i) => (
            <GenreRail key={genre} genre={genre} index={i + 1} />
          ))}
          <BecauseYouLiked index={genres.length + 1} />
        </div>
      ) : (
        <GuestIntro />
      )}
    </div>
  )
}

export default Home
