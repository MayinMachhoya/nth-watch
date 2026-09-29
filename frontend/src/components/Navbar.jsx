import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Sun, Moon, LogOut, User, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SearchDropdown from './SearchDropdown';
import Logo from './Logo';

const Navbar = () => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const debounceTimerRef = useRef(null);

  // Sync search input with URL when on /search page
  useEffect(() => {
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search);
      const q = params.get('q') || '';
      setSearchQuery(q);
      setDebouncedQuery(''); // Don't show dropdown on /search page
      setIsDropdownOpen(false);
    }
  }, [location.pathname, location.search]);

  // Close everything on route change
  useEffect(() => {
    setIsDropdownOpen(false);
    setIsMobileSearchOpen(false);
  }, [location.pathname]);

  // ── Debounced search ────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);

    clearTimeout(debounceTimerRef.current);

    if (value.trim().length < 2) {
      setDebouncedQuery('');
      setIsDropdownOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
      setIsDropdownOpen(true);
    }, 300);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => clearTimeout(debounceTimerRef.current);
  }, []);

  // ── Keyboard handlers ───────────────────────────────────────────────────
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
      setIsDropdownOpen(false);
      setIsMobileSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  }, [searchQuery, navigate]);

  // Navigate to full search results
  const handleNavigateToSearch = useCallback((query) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }, [navigate]);

  // ── Click outside handlers ──────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close search dropdown on click outside
      if (
        desktopSearchRef.current && !desktopSearchRef.current.contains(e.target) &&
        mobileSearchRef.current && !mobileSearchRef.current.contains(e.target)
      ) {
        setIsDropdownOpen(false);
      }
      // Also handle case where mobile search ref doesn't exist yet
      if (
        desktopSearchRef.current && !desktopSearchRef.current.contains(e.target) &&
        !mobileSearchRef.current
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="sticky top-0 z-nav">
      <header className="bg-ink border-b border-line transition-colors duration-base">
        <div className="flex items-center justify-between gap-md px-gutter py-sm lg:py-md max-w-page mx-auto w-full">
          {/* Left section: Logo for mobile/tablet */}
          <Link to="/" className="flex items-center shrink-0 lg:hidden" aria-label="Nth Watch home">
            <Logo className="w-logo h-auto" />
          </Link>

          {/* Right section: Search, Theme, Profile */}
          <div className="flex items-center justify-end md:justify-between w-full gap-sm lg:gap-lg">

            {/* Desktop & Tablet Search Bar */}
            <div className="hidden md:block relative flex-1 max-w-search" ref={desktopSearchRef}>
              <div className="group flex items-center gap-sm bg-surface rounded-sm px-md h-control border border-line focus-within:border-accent transition-colors duration-fast">
                <Search size={16} strokeWidth={1.75} className="text-fg-subtle group-focus-within:text-accent shrink-0 transition-colors duration-fast" />
                <input
                  type="text"
                  placeholder="Search films, directors, actors…"
                  aria-label="Search films, directors or actors"
                  className="bg-transparent border-none outline-none text-small text-fg placeholder:text-fg-subtle w-full"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => {
                    if (debouncedQuery.length >= 2 && location.pathname !== '/search') {
                      setIsDropdownOpen(true);
                    }
                  }}
                />
                <span className="hidden lg:inline label text-fg-subtle shrink-0">Enter ↵</span>
              </div>
              {/* Search Dropdown (desktop) */}
              <SearchDropdown
                query={debouncedQuery}
                isOpen={isDropdownOpen && location.pathname !== '/search'}
                onClose={() => setIsDropdownOpen(false)}
                onNavigate={handleNavigateToSearch}
              />
            </div>

            <div className="flex items-center gap-xs shrink-0">
              {/* Mobile Search Icon */}
              <button
                className="md:hidden flex items-center justify-center size-control rounded-sm border border-line text-fg-muted hover:text-fg hover:border-line-strong transition-colors duration-fast"
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                aria-label="Open search"
              >
                <Search size={18} strokeWidth={1.75} />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center size-control rounded-sm border border-line text-fg-muted hover:text-accent hover:border-accent transition-colors duration-fast"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
              </button>

              {/* Profile */}
              <button
                onClick={() => navigate(isAuthenticated ? '/settings' : '/login')}
                className="flex items-center justify-center size-control overflow-hidden rounded-full border border-line-strong hover:border-accent transition-colors duration-fast shrink-0"
                aria-label={isAuthenticated ? 'Account settings' : 'Sign in'}
              >
                {isAuthenticated && user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : isAuthenticated ? (
                  <div className="w-full h-full bg-accent flex items-center justify-center font-display text-lead text-accent-ink">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                ) : (
                  <div className="w-full h-full bg-surface flex items-center justify-center">
                    <User size={18} strokeWidth={1.75} className="text-fg-muted" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar Dropdown */}
      {isMobileSearchOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 px-gutter py-sm bg-ink border-b border-line animate-fade z-dropdown"
          ref={mobileSearchRef}
        >
          <div className="relative">
            <div className="flex items-center gap-sm bg-surface rounded-sm px-md h-control border border-line focus-within:border-accent transition-colors duration-fast">
              <Search size={16} strokeWidth={1.75} className="text-fg-subtle shrink-0" />
              <input
                type="text"
                placeholder="Search films…"
                aria-label="Search films, directors or actors"
                className="bg-transparent border-none outline-none text-small text-fg placeholder:text-fg-subtle w-full"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            {/* Search Dropdown (mobile) */}
            <SearchDropdown
              query={debouncedQuery}
              isOpen={isDropdownOpen && location.pathname !== '/search'}
              onClose={() => { setIsDropdownOpen(false); setIsMobileSearchOpen(false); }}
              onNavigate={handleNavigateToSearch}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;
