import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullMovieData } from '../services/tmdbService';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useUserInteractions } from '../context/UserInteractionsContext';
import LoadingSpinner from '../components/LoadingSpinner';
import SimilarMoviesSlider from '../components/SimilarMoviesSlider';
import SectionHeading from '../components/SectionHeading';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Bookmark, Heart, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MovieDetails = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const { watchlist, favourites, toggleWatchlist, toggleFavourite } = useUserInteractions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [movie, setMovie] = useState(null);
  const [localMeta, setLocalMeta] = useState(null);

  const [lightboxIndex, setLightboxIndex] = useState(-1);

  useDocumentTitle(movie?.title ? `${movie.title}${movie.release_date ? ` (${movie.release_date.substring(0, 4)})` : ''}` : 'Movie');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchLocal = isAuthenticated ? apiFetch(`/api/movies/tmdb/${tmdbId}`, {}, token).catch(() => ({ data: null })) : Promise.resolve({ data: null });

      const [tmdbData, localData] = await Promise.all([
        getFullMovieData(tmdbId),
        fetchLocal
      ]);

      if (!tmdbData || tmdbData.success === false) {
        throw new Error("Movie details not available.");
      }

      setMovie(tmdbData);
      setLocalMeta(localData?.data || { inWatchlist: false, inFavourites: false });
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load movie details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tmdbId, token, isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner text="Loading movie details..." />;

  if (error) {
    return (
      <div className="flex flex-col items-start justify-center min-h-empty-h px-gutter gap-md">
        <span className="label text-fg-subtle"><span className="text-accent">Err</span> / Reel jammed</span>
        <p className="font-display text-section text-fg max-w-prose">{error}</p>
        <button onClick={fetchData} className="px-lg h-control rounded-sm bg-accent text-accent-ink font-semibold text-small hover:bg-accent-strong transition-colors duration-fast">
          Retry
        </button>
      </div>
    );
  }

  const { title, overview, release_date, runtime, vote_average, poster_path, backdrop_path, genres, production_countries, credits, images, pgRating } = movie;

  const year = release_date ? release_date.substring(0, 4) : '';
  const runHrs = Math.floor(runtime / 60);
  const runMins = runtime % 60;

  const backdropUrl = backdrop_path ? `https://image.tmdb.org/t/p/w1280${backdrop_path}` : null;
  const posterUrl = poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null;

  const directors = credits.crew.filter(c => c.job === 'Director');
  const cast = credits.cast.sort((a, b) => a.order - b.order).slice(0, 10);
  const screenshots = images.backdrops.slice(0, 6);

  const inWatchlist = localMeta?.movie_id ? watchlist.has(localMeta.movie_id) : false;
  const inFavourites = localMeta?.movie_id ? favourites.has(localMeta.movie_id) : false;
  const railClass = 'flex overflow-x-auto gap-md pb-xs snap-x no-scrollbar';
  const metaItems = [
    year,
    runtime > 0 && `${runHrs > 0 ? `${runHrs}h ` : ''}${runMins}m`,
    pgRating && <span className="px-xs border border-line-strong rounded-xs text-fg text-micro">{pgRating}</span>,
    production_countries?.length > 0 && production_countries[0].name,
  ].filter(Boolean);

  return (
    <div className="relative min-h-screen bg-ink animate-fade transition-colors duration-base">
      {/* Hero Section — theme-dark keeps the backdrop overlay (and the type on it) dark in light mode too */}
      <section className="theme-dark relative bg-ink transition-colors duration-base">
      <div className="absolute top-0 left-0 right-0 h-backdrop z-0 overflow-hidden">
        {backdropUrl ? (
          <img src={backdropUrl} alt="" className="w-full h-full object-cover object-center" />
        ) : (
          <div className="w-full h-full poster-fallback" />
        )}
        <div className="absolute inset-0 fade-to-ink-b" />
        <div className="absolute inset-0 fade-to-ink-r" />
      </div>

      {/* Main Content container */}
      <div className="relative z-raised max-w-page mx-auto px-gutter pt-backdrop-offset pb-xl">
        <div className="flex flex-col md:flex-row gap-xl lg:gap-2xl">

          {/* Left Column (Poster) */}
          <div className="w-full md:w-1/3 max-w-poster-sm sm:max-w-poster-md md:max-w-poster mx-auto md:mx-0 shrink-0 animate-rise">
            <div className="rounded-sm overflow-hidden border border-line-strong poster-fallback aspect-poster">
              {posterUrl ? (
                <img src={posterUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-display text-fg-subtle">
                  {title ? title.split(' ').map(w => w[0]).join('').substring(0, 3) : '?'}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Info) */}
          <div className="w-full md:w-2/3 flex flex-col justify-end gap-lg">
            <div className="animate-rise stagger" style={{ '--i': 1 }}>
              <div className="label text-fg-muted mb-sm">
                <span className="text-accent">Feature</span> / {year || 'Undated'}
              </div>
              <h1 className="font-display text-display text-fg tracking-tightest">
                {title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs font-mono text-caption text-fg-muted animate-rise stagger" style={{ '--i': 2 }}>
              {metaItems.map((item, i) => (
                // Each separator travels with its item so a wrapped line never ends on "/"
                <span key={i} className="inline-flex items-center gap-sm whitespace-nowrap">
                  {i > 0 && <span className="text-fg-subtle">/</span>}
                  {item}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-xs animate-rise stagger" style={{ '--i': 3 }}>
              {genres && genres.map(g => (
                <span key={g.id} className="px-sm py-2xs bg-surface border border-line rounded-xs text-caption font-medium text-fg">
                  {g.name}
                </span>
              ))}
            </div>

            <div className="flex items-end gap-md animate-rise stagger" style={{ '--i': 4 }}>
              <div className="flex items-baseline gap-2xs">
                <span className="font-display text-heading text-brass">{(vote_average / 2).toFixed(1)}</span>
                <span className="font-mono text-caption text-fg-subtle">/5</span>
              </div>
              <div className="pb-2xs">
                <div className="text-brass text-lead leading-none tracking-wide" aria-hidden="true">
                  {'★'.repeat(Math.round(vote_average / 2))}<span className="text-fg-subtle">{'☆'.repeat(5 - Math.round(vote_average / 2))}</span>
                </div>
                <div className="font-mono text-micro text-fg-subtle mt-2xs">{vote_average.toFixed(1)} TMDB</div>
              </div>
            </div>

            {/* Action Buttons */}
            {localMeta?.movie_id && isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-sm animate-rise stagger" style={{ '--i': 5 }}>
                <button
                  onClick={() => toggleWatchlist(localMeta)}
                  className={`flex items-center justify-center gap-xs px-lg h-control-lg rounded-sm font-semibold text-body border transition-all duration-fast ${inWatchlist
                    ? 'bg-transparent border-accent text-accent'
                    : 'bg-accent border-accent text-accent-ink hover:-translate-x-3xs hover:-translate-y-3xs hover:shadow-hard'
                    }`}
                >
                  <Bookmark size={18} fill={inWatchlist ? 'currentColor' : 'none'} />
                  {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
                <button
                  onClick={() => toggleFavourite(localMeta)}
                  className={`flex items-center justify-center gap-xs px-lg h-control-lg rounded-sm font-semibold text-body border transition-colors duration-fast ${inFavourites
                    ? 'bg-accent-wash border-accent text-accent'
                    : 'bg-transparent border-line-strong text-fg hover:border-fg'
                    }`}
                >
                  <Heart size={18} fill={inFavourites ? 'currentColor' : 'none'} />
                  {inFavourites ? 'Favourited' : 'Add to Favourites'}
                </button>
              </div>
            )}

            <div className="border-t border-line pt-md animate-rise stagger" style={{ '--i': 6 }}>
              <h3 className="label text-fg-subtle mb-sm">Overview</h3>
              <p className="text-lead text-fg-muted max-w-prose">
                {overview || "No overview available."}
              </p>
            </div>
          </div>
        </div>
      </div>
      </section>

      <div className="relative z-raised max-w-page mx-auto px-gutter pb-3xl">
        {/* Director Section */}
        {directors.length > 0 && (
          <section className="mt-3xl">
            <SectionHeading index="01" eyebrow="Behind the camera" title="Director" as="h3" />
            <div className="flex flex-col sm:flex-row flex-wrap gap-sm">
              {directors.map(dir => (
                <button
                  key={dir.id}
                  onClick={() => navigate(`/person/${dir.id}`)}
                  className="group flex items-center gap-md p-sm pr-lg rounded-sm border border-line hover:border-accent transition-colors duration-fast text-left w-full sm:w-auto"
                >
                  <div className="size-avatar-md rounded-full overflow-hidden poster-fallback border border-line shrink-0">
                    {dir.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w185${dir.profile_path}`} alt={dir.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-display text-title text-fg-subtle">
                        {dir.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-display text-title text-fg">{dir.name}</div>
                    <div className="label text-accent mt-2xs">View profile →</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Cast Section */}
        {cast.length > 0 && (
          <section className="mt-3xl">
            <SectionHeading index="02" eyebrow="Top billed" title="Cast" as="h3" />
            <div className={railClass}>
              {cast.map(actor => (
                <button
                  key={actor.id}
                  onClick={() => navigate(`/person/${actor.id}`)}
                  className="flex flex-col w-cast-sm sm:w-cast shrink-0 snap-start text-left group"
                >
                  <div className="w-full aspect-poster poster-fallback rounded-sm overflow-hidden border border-line group-hover:border-line-strong transition-colors duration-fast relative">
                    {actor.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-hover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-display text-heading text-fg-subtle">
                        {actor.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="pt-xs">
                    <div className="font-semibold text-fg text-small line-clamp-1 group-hover:text-accent transition-colors duration-fast">{actor.name}</div>
                    <div className="text-caption text-fg-subtle mt-3xs line-clamp-2">{actor.character}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Screenshots Section */}
        {screenshots.length > 0 && (
          <section className="mt-3xl">
            <SectionHeading index="03" eyebrow="Stills" title="Screenshots" as="h3" />
            <div className={railClass}>
              {screenshots.map((img, i) => (
                <button
                  key={img.file_path}
                  onClick={() => setLightboxIndex(i)}
                  className="relative shrink-0 w-shot-sm sm:w-shot-md md:w-shot rounded-sm overflow-hidden aspect-still poster-fallback border border-line hover:border-line-strong transition-colors duration-fast group snap-start"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w780${img.file_path}`}
                    alt={`Screenshot ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-hover"
                    loading="lazy"
                  />
                  <span className="absolute left-xs bottom-xs font-mono text-micro text-on-image bg-scrim-solid px-2xs py-3xs rounded-xs tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Similar Movies */}
        {localMeta?.movie_id && (
          <SimilarMoviesSlider
            key={tmdbId}
            movieId={localMeta.movie_id}
            movieTitle={title}
          />
        )}

      </div>

      {/* Lightbox Modal */}
      {lightboxIndex >= 0 && (
        <div className="fixed inset-0 z-top bg-scrim-solid flex items-center justify-center animate-fade" onClick={() => setLightboxIndex(-1)}>
          <button
            onClick={() => setLightboxIndex(-1)}
            className="absolute top-md right-md flex items-center justify-center size-control-lg rounded-sm border border-line-strong text-on-image hover:border-accent hover:text-accent transition-colors duration-fast"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <span className="absolute top-md left-md label text-on-image">
            <span className="text-accent">{String(lightboxIndex + 1).padStart(2, '0')}</span> / {String(screenshots.length).padStart(2, '0')}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev > 0 ? prev - 1 : screenshots.length - 1); }}
            className="absolute left-xs sm:left-md lg:left-2xl top-1/2 -translate-y-1/2 flex items-center justify-center size-control-lg rounded-sm border border-line-strong bg-scrim-soft text-on-image hover:border-accent hover:text-accent transition-colors duration-fast"
            aria-label="Previous screenshot"
          >
            <ChevronLeft size={24} />
          </button>

          <img
            src={`https://image.tmdb.org/t/p/w1280${screenshots[lightboxIndex].file_path}`}
            alt="Fullscreen Screenshot"
            className="max-w-lightbox max-h-lightbox object-contain rounded-xs"
          />

          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev < screenshots.length - 1 ? prev + 1 : 0); }}
            className="absolute right-xs sm:right-md lg:right-2xl top-1/2 -translate-y-1/2 flex items-center justify-center size-control-lg rounded-sm border border-line-strong bg-scrim-soft text-on-image hover:border-accent hover:text-accent transition-colors duration-fast"
            aria-label="Next screenshot"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default MovieDetails;
