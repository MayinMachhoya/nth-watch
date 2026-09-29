import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Film, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchMovies, searchPeople, batchFetchPosters } from '../services/searchService';
import InteractiveMovieCard from '../components/InteractiveMovieCard';

import SectionHeading from '../components/SectionHeading';
import useDocumentTitle from '../hooks/useDocumentTitle';

// ── Skeleton Components ──────────────────────────────────────────────────────

const MovieCardSkeleton = () => (
  <div>
    <div className="aspect-poster skeleton rounded-sm" />
    <div className="pt-xs space-y-xs">
      <div className="h-sm skeleton rounded-xs w-3/4" />
      <div className="h-xs skeleton rounded-xs w-1/2" />
      <div className="h-rule skeleton w-full" />
    </div>
  </div>
);

const PersonCardSkeleton = () => (
  <div className="flex flex-col items-center p-md">
    <div className="size-avatar-lg rounded-full skeleton mb-sm" />
    <div className="h-sm skeleton rounded-xs w-3/4 mb-xs" />
    <div className="h-xs skeleton rounded-xs w-1/2" />
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const query = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState('all');
  useDocumentTitle(query ? `Search: ${query}` : 'Search');


  const [movies, setMovies] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(null);

  // ── Fetch on query change ───────────────────────────────────────────────
  useEffect(() => {
    if (!query || query.length < 2) {
      setMovies([]);
      setPeople([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setActiveTab('all');

    const fetchResults = async () => {
      try {
        const [movieResults, peopleResults] = await Promise.all([
          searchMovies(query, 20, token, controller.signal).catch(() => []),
          searchPeople(query, 10, controller.signal).catch(() => []),
        ]);

        if (controller.signal.aborted) return;

        setMovies(movieResults);
        setPeople(peopleResults);

        // Batch-fetch posters
        const tmdbIds = movieResults
          .map(m => m.tmdbId || m.tmdb_id)
          .filter(Boolean);
        if (tmdbIds.length > 0) {
          await batchFetchPosters(tmdbIds);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Search results error:', err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchResults();

    return () => controller.abort();
  }, [query, token]);

  // ── Tab filtering ───────────────────────────────────────────────────────
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'people', label: 'People' },
  ];

  const showMovies = activeTab === 'all' || activeTab === 'movies';
  const showPeople = activeTab === 'all' || activeTab === 'people';

  // ── Movie Grid Columns (match FindYourMovie `Comfortable` size) ─────
  const gridColsClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  const personGridClass = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  // ── Empty query state ───────────────────────────────────────────────────
  if (!query || query.length < 2) {
    return (
      <div className="flex flex-col items-start justify-center min-h-empty-h px-gutter gap-sm">
        <span className="label text-fg-subtle"><span className="text-accent">00</span> / Search</span>
        <p className="font-display text-section text-fg">Enter a search term to find movies and people.</p>
      </div>
    );
  }

  const count = (n) => String(n).padStart(2, '0');

  return (
    <div className="px-gutter py-xl space-y-xl animate-fade">
      {/* Header */}
      <header>
        <div className="label text-fg-subtle mb-sm">
          <span className="text-accent">Search</span> / Results
        </div>
        <h1 className="font-display text-display text-fg tracking-tightest break-words">
          “<em className="text-accent">{query}</em>”
        </h1>
        {!loading && (
          <p className="font-mono text-caption text-fg-muted mt-sm">
            {movies.length} movie{movies.length !== 1 ? 's' : ''} · {people.length} {people.length !== 1 ? 'people' : 'person'} found
          </p>
        )}
      </header>

      {/* Tab Bar */}
      <div className="flex gap-lg border-b border-line" role="tablist">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`relative pb-sm text-small font-semibold transition-colors duration-fast ${activeTab === key
              ? 'text-fg'
              : 'text-fg-subtle hover:text-fg'
              }`}
          >
            {label}
            <span className={`absolute left-0 right-0 -bottom-px h-rule transition-colors duration-fast ${activeTab === key ? 'bg-accent' : 'bg-transparent'}`} />
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-xl">
          <div>
            <div className="flex items-center gap-xs mb-lg">
              <Loader2 size={14} className="text-accent animate-spin" />
              <span className="label text-fg-subtle">Searching</span>
            </div>
            <div className={`grid ${gridColsClass} gap-x-md gap-y-xl`}>
              {Array.from({ length: 10 }).map((_, i) => <MovieCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className="space-y-2xl">
          {/* Both empty */}
          {movies.length === 0 && people.length === 0 && (
            <div className="flex flex-col items-start py-2xl">
              <Search size={32} strokeWidth={1.5} className="text-fg-subtle mb-md" />
              <p className="font-display text-section text-fg mb-xs">No results found</p>
              <p className="text-fg-muted text-small">
                We couldn&apos;t find anything for “<span className="text-fg">{query}</span>”. Try a different search.
              </p>
            </div>
          )}

          {/* Movies Section */}
          {showMovies && movies.length > 0 && (
            <section>
              <SectionHeading
                index={count(movies.length)}
                eyebrow="Titles"
                title="Movies"
                action={<Film size={18} strokeWidth={1.5} className="text-fg-subtle" />}
              />
              <div className={`grid ${gridColsClass} gap-x-md gap-y-xl`}>
                {movies.map((movie, i) => {
                  const id = movie.movieId || movie.movie_id;
                  const tmdbId = movie.tmdbId || movie.tmdb_id;

                  return (
                    <InteractiveMovieCard
                      key={id}
                      movie={movie}
                      style={{ '--i': i }}
                      className="animate-rise stagger"
                      onClick={() => navigate(`/movie/${tmdbId}`)}
                      showScoreBar={true}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Movies empty state */}
          {showMovies && movies.length === 0 && people.length > 0 && (
            <section>
              <SectionHeading index="00" eyebrow="Titles" title="Movies" />
              <p className="text-fg-subtle font-display italic text-lead">No movies found for “{query}”</p>
            </section>
          )}

          {/* People Section */}
          {showPeople && people.length > 0 && (
            <section>
              <SectionHeading
                index={count(people.length)}
                eyebrow="Cast & crew"
                title="People"
                action={<Users size={18} strokeWidth={1.5} className="text-fg-subtle" />}
              />
              <div className={`grid ${personGridClass} gap-md`}>
                {people.map((person, i) => {
                  const photoUrl = person.profile_path
                    ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
                    : null;

                  return (
                    <button
                      key={person.id}
                      onClick={() => navigate(`/person/${person.id}`)}
                      className="flex flex-col items-center p-md rounded-sm border border-line hover:border-accent transition-colors duration-fast text-center group animate-rise stagger"
                      style={{ '--i': i }}
                    >
                      {/* Profile photo */}
                      <div className="size-avatar-lg rounded-full overflow-hidden poster-fallback mb-sm border border-line">
                        {photoUrl ? (
                          <img src={photoUrl} alt={person.name} className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-hover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-display text-heading text-fg-subtle">
                            {person.name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <h3 className="text-small font-semibold text-fg truncate w-full group-hover:text-accent transition-colors duration-fast">
                        {person.name}
                      </h3>
                      <p className="label text-fg-subtle mt-2xs">
                        {person.known_for_department || 'Unknown'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* People empty state */}
          {showPeople && people.length === 0 && movies.length > 0 && (
            <section>
              <SectionHeading index="00" eyebrow="Cast & crew" title="People" />
              <p className="text-fg-subtle font-display italic text-lead">No people found for “{query}”</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
