import React from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';

// Viewfinder crop marks for the hero corners
const CropMark = ({ className }) => (
  <span className={`absolute size-md border-line-strong ${className}`} aria-hidden="true" />
);

const HeroBanner = () => {
  return (
    <div className="px-gutter pt-lg pb-xl">
      {/* theme-dark: the overlay (and the type on it) stay dark in light mode too */}
      <div className="theme-dark relative w-full h-hero rounded-sm overflow-hidden group border border-line bg-ink">
        {/* Background Image */}
        <img
          src="/banner.png"
          alt="Inception — featured film"
          className="w-full h-full object-cover transition-transform duration-slower ease-out group-hover:scale-hover"
        />

        {/* Fade into the page */}
        <div className="absolute inset-0 fade-to-ink-r" />
        <div className="absolute inset-0 fade-to-ink-b" />

        <CropMark className="top-md left-md border-t border-l" />
        <CropMark className="top-md right-md border-t border-r" />
        <CropMark className="bottom-md left-md border-b border-l" />
        <CropMark className="bottom-md right-md border-b border-r" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end px-lg sm:px-2xl pb-lg sm:pb-2xl w-full lg:w-2/3">
          <div className="label text-fg-muted mb-sm animate-rise">
            <span className="text-accent">Nº 01</span> / Tonight&apos;s feature
          </div>

          {/* Movie Title */}
          <h1 className="font-display italic text-mega text-fg tracking-tightest mb-md animate-rise stagger" style={{ '--i': 1 }}>
            Inception
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-sm mb-lg font-mono text-caption text-fg-muted animate-rise stagger" style={{ '--i': 2 }}>
            <span className="flex items-center gap-xs">
              <span className="bg-imdb text-imdb-ink px-2xs rounded-xs font-sans font-bold text-micro">IMDb</span>
              <span className="text-fg">7.8</span>
            </span>
            <span className="text-fg-subtle">/</span>
            <span>2010</span>
            <span className="text-fg-subtle">/</span>
            <span>US</span>
            <span className="text-fg-subtle">/</span>
            <span>English</span>
          </div>

          {/* Watch Button */}
          <Link
            to="/movie/27205"
            className="flex items-center gap-xs bg-accent text-accent-ink px-lg h-control-lg rounded-sm w-max font-semibold text-body transition-all duration-fast hover:-translate-x-3xs hover:-translate-y-3xs hover:shadow-hard hover:bg-accent-strong animate-rise stagger"
            style={{ '--i': 3 }}
          >
            <Play size={18} fill="currentColor" /> Watch
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
