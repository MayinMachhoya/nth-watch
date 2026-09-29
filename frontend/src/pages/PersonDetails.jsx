import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPersonDetails, getPersonMovieCredits } from '../services/tmdbService';
import { apiFetch } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import SectionHeading from '../components/SectionHeading';
import useDocumentTitle from '../hooks/useDocumentTitle';

const PersonDetails = () => {
  const { personId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [person, setPerson] = useState(null);
  const [expandedBio, setExpandedBio] = useState(false);

  // These will just be movies that are actually in our NeonDB database
  const [actingMovies, setActingMovies] = useState([]);
  const [directingMovies, setDirectingMovies] = useState([]);

  useDocumentTitle(person?.name || 'Person');

  // UI Preference
  const [cardSize, setCardSize] = useState('Comfortable');

  useEffect(() => {
    setCardSize(localStorage.getItem('cardSize') || 'Comfortable');
    const handleStorageChange = () => setCardSize(localStorage.getItem('cardSize') || 'Comfortable');
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [personData, credits] = await Promise.all([
        getPersonDetails(personId),
        getPersonMovieCredits(personId)
      ]);

      if (!personData || personData.success === false) {
        throw new Error("Person details not available.");
      }

      setPerson(personData);

      // Collect all TMDB IDs they've touched
      const castIds = (credits?.cast || []).map(m => m.id);
      const crewIds = (credits?.crew || []).filter(c => c.job === 'Director').map(m => m.id);
      const allIds = [...new Set([...castIds, ...crewIds])];

      if (allIds.length > 0) {
        // Query backend to see which of these are actually in our db
        const res = await apiFetch('/api/movies/by-tmdb-ids', {
          method: 'POST',
          body: JSON.stringify({ tmdb_ids: allIds })
        }).catch(() => ({ data: [] }));

        const localMovies = res.data;

        const finalActing = [];
        const finalDirecting = [];

        const tmdbCastMap = new Map((credits?.cast || []).map(m => [m.id, m]));
        const tmdbCrewMap = new Map((credits?.crew || []).filter(c => c.job === 'Director').map(m => [m.id, m]));

        localMovies.forEach(lm => {
          // If they acted in it
          if (tmdbCastMap.has(lm.tmdb_id)) {
            finalActing.push({
              ...lm,
              poster_path: tmdbCastMap.get(lm.tmdb_id).poster_path
            });
          }
          // If they directed it
          if (tmdbCrewMap.has(lm.tmdb_id)) {
            finalDirecting.push({
              ...lm,
              poster_path: tmdbCrewMap.get(lm.tmdb_id).poster_path
            });
          }
        });

        setActingMovies(finalActing);
        setDirectingMovies(finalDirecting);
      } else {
        setActingMovies([]);
        setDirectingMovies([]);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load person details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner text="Loading person details..." />;

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

  const { name, biography, birthday, place_of_birth, profile_path, known_for_department } = person;
  const profileUrl = profile_path ? `https://image.tmdb.org/t/p/w500${profile_path}` : null;
  const showReadMore = biography && biography.length > 500;

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

  const MovieGrid = ({ index, eyebrow, title, movies }) => (
    <section className="mb-2xl">
      <SectionHeading index={index} eyebrow={eyebrow} title={title} as="h3" />
      {movies.length > 0 ? (
        <div className={`grid ${gridColsClass} gap-x-md gap-y-xl`}>
          {movies.map((movie, i) => (
            <button
              key={movie.movie_id}
              onClick={() => navigate(`/movie/${movie.tmdb_id}`)}
              className="flex flex-col text-left group min-w-0 animate-rise stagger"
              style={{ '--i': i }}
            >
              <div className="w-full aspect-poster poster-fallback relative rounded-sm overflow-hidden border border-line group-hover:border-line-strong transition-colors duration-base">
                {movie.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-hover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full font-display text-heading text-fg-subtle px-xs text-center">
                    {movie.title ? movie.title.split(' ').map(w => w[0]).join('').substring(0, 3) : '?'}
                  </div>
                )}
              </div>
              <div className="pt-xs w-full min-w-0">
                <h4 className="text-small font-semibold text-fg truncate group-hover:text-accent transition-colors duration-fast" title={movie.title}>{movie.title}</h4>
                <p className="font-mono text-micro text-fg-subtle truncate mt-3xs">
                  {movie.year || '—'}
                  {movie.genres && typeof movie.genres === 'string' ? ` · ${movie.genres.split('|').slice(0, 2).join(', ')}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-fg-subtle italic font-display text-lead">No movies from our collection.</p>
      )}
    </section>
  );

  const InfoRow = ({ label, children }) => (
    <div className="flex items-baseline justify-between gap-md py-sm border-b border-line">
      <dt className="label text-fg-subtle shrink-0">{label}</dt>
      <dd className="text-small text-fg text-right">{children}</dd>
    </div>
  );

  return (
    <div className="max-w-page mx-auto px-gutter py-xl animate-fade min-h-screen">
      <div className="flex flex-col md:flex-row gap-xl lg:gap-2xl">
        {/* Left Column (Profile) */}
        <aside className="w-full md:w-1/4 max-w-profile-sm sm:max-w-profile md:max-w-poster mx-auto md:mx-0 shrink-0 animate-rise">
          <div className="rounded-sm overflow-hidden border border-line-strong poster-fallback aspect-poster">
            {profileUrl ? (
              <img src={profileUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display text-display text-fg-subtle">
                {name ? name.charAt(0) : '?'}
              </div>
            )}
          </div>

          <div className="mt-lg">
            <h3 className="label text-fg-muted border-b border-line-strong pb-xs">Personal Info</h3>
            <dl>
              <InfoRow label="Known For">
                {known_for_department === 'Acting' ? 'Acting' : known_for_department === 'Directing' ? 'Directing' : known_for_department || 'Unknown'}
              </InfoRow>
              {birthday && (
                <InfoRow label="Birthday">
                  {new Date(birthday).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </InfoRow>
              )}
              {place_of_birth && (
                <InfoRow label="Place of Birth">{place_of_birth}</InfoRow>
              )}
            </dl>
          </div>
        </aside>

        {/* Right Column (Bio and Movies) */}
        <div className="w-full md:w-3/4 flex flex-col min-w-0">
          <div className="label text-fg-subtle mb-sm animate-rise">
            <span className="text-accent">Profile</span> / {known_for_department || 'Film'}
          </div>
          <h1 className="font-display text-display text-fg tracking-tightest mb-xl animate-rise stagger" style={{ '--i': 1 }}>
            {name}
          </h1>

          <div className="mb-2xl animate-rise stagger" style={{ '--i': 2 }}>
            <h3 className="label text-fg-subtle mb-sm">Biography</h3>
            {biography ? (
              <div>
                <div className={`text-fg-muted space-y-md text-body max-w-prose ${expandedBio ? '' : 'line-clamp-6 sm:line-clamp-8 md:line-clamp-6'}`}>
                  {biography.split('\n').filter(p => p.trim() !== '').map((para, i) => <p key={i}>{para}</p>)}
                </div>
                {showReadMore && (
                  <button
                    onClick={() => setExpandedBio(!expandedBio)}
                    className="mt-sm label text-accent hover:text-fg transition-colors duration-fast"
                  >
                    {expandedBio ? 'Read Less' : 'Read More'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-fg-subtle italic font-display text-lead">No biography available.</p>
            )}
          </div>

          {/* Movie Lists */}
          {(actingMovies.length > 0 || directingMovies.length === 0) && known_for_department !== 'Directing' && (
            <MovieGrid index="01" eyebrow="Filmography" title={`More Movies by ${name}`} movies={actingMovies} />
          )}

          {directingMovies.length > 0 && (
            <MovieGrid index="02" eyebrow="Director's chair" title={`Directed by ${name}`} movies={directingMovies} />
          )}

          {/* Fallback if zero acting and zero directing */}
          {actingMovies.length === 0 && directingMovies.length === 0 && (
            <section className="mb-2xl">
              <SectionHeading index="00" eyebrow="Catalogue" title="Our Database" as="h3" />
              <p className="text-fg-subtle italic font-display text-lead">No movies from our collection.</p>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

export default PersonDetails;
