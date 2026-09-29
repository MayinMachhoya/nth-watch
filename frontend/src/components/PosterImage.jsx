import React, { useState, useEffect, useRef } from 'react';
import { getMovieDetails } from '../services/tmdbService';

export const posterCache = new Map();

const PosterImage = ({ tmdbId, alt, getPosterColor, movieId, getInitials }) => {
  const [posterUrl, setPosterUrl] = useState(posterCache.get(tmdbId) || null);
  const imgRef = useRef();

  useEffect(() => {
    if (!tmdbId || posterUrl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          getMovieDetails(tmdbId).then(data => {
            if (data?.poster_path) {
              const url = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
              posterCache.set(tmdbId, url);
              setPosterUrl(url);
            }
          });
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [tmdbId, posterUrl]);

  if (posterUrl) {
    return (
      <div ref={imgRef} className="w-full h-full absolute inset-0">
        <img src={posterUrl} alt={alt} className="w-full h-full object-cover animate-fade transition-transform duration-slow ease-out group-hover:scale-hover" loading="lazy" />
      </div>
    );
  }

  return (
    <div ref={imgRef} className="w-full h-full absolute inset-0 poster-fallback flex flex-col items-center justify-center gap-xs">
      <span className={`font-display text-heading select-none ${getPosterColor(movieId)}`}>
        {getInitials(alt)}
      </span>
    </div>
  );
};

export default PosterImage;
