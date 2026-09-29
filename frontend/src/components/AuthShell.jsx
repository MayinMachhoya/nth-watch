import React from 'react';
import { Link } from 'react-router-dom';

// Typographic wordmark used where the logo image isn't shown.
export const Wordmark = ({ className = '' }) => (
  <Link to="/" className={`inline-flex items-baseline gap-2xs font-display text-title text-fg ${className}`} aria-label="Nth Watch home">
    <em className="text-accent">Nth</em>
    <span>Watch</span>
  </Link>
);

// Shared input-row styling for the auth forms
export const fieldClass = 'flex items-center gap-sm bg-surface border border-line rounded-sm px-md h-control-lg focus-within:border-accent transition-colors duration-fast';
export const inputClass = 'flex-1 min-w-0 bg-transparent border-none outline-none text-body text-fg placeholder:text-fg-subtle';

// Split-screen frame for Login / Register: poster panel + form column.
// `overlay` renders outside the animated column so fixed modals position correctly.
const AuthShell = ({ eyebrow, title, subtitle, children, footer, overlay }) => (
  <div className="min-h-screen grid lg:grid-cols-2 bg-ink transition-colors duration-base">
    {/* Poster panel */}
    <aside className="hidden lg:flex relative overflow-hidden border-r border-line">
      <img src="/banner.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 fade-to-ink-b" />
      <div className="absolute inset-0 bg-scrim-soft" />

      <div className="relative z-raised flex flex-col justify-between w-full p-2xl">
        <Wordmark />
        <div className="animate-rise">
          <div className="label text-fg-muted mb-md">
            <span className="text-accent">Nº 01</span> / Now showing
          </div>
          <p className="font-display text-display text-fg tracking-tightest max-w-prose">
            Every great film is somebody&apos;s <em className="text-accent">nth</em> watch.
          </p>
        </div>
      </div>
    </aside>

    {/* Form column */}
    <main className="flex flex-col justify-center px-gutter py-2xl">
      <div className="w-full max-w-form mx-auto animate-rise">
        <Wordmark className="lg:hidden mb-2xl" />

        <div className="label text-fg-subtle mb-sm">
          <span className="text-accent">{eyebrow}</span>
        </div>
        <h1 className="font-display text-heading text-fg tracking-tight mb-xs">{title}</h1>
        <p className="text-body text-fg-muted mb-xl">{subtitle}</p>

        {children}

        {footer && (
          <p className="text-small text-fg-muted border-t border-line pt-lg mt-xl">
            {footer}
          </p>
        )}
      </div>
    </main>

    {overlay}
  </div>
);

export default AuthShell;
