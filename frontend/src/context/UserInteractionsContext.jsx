import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, apiFetch } from './AuthContext';

const UserInteractionsContext = createContext(null);

export const useUserInteractions = () => {
  const ctx = useContext(UserInteractionsContext);
  if (!ctx) throw new Error('useUserInteractions must be used within UserInteractionsProvider');
  return ctx;
};

// Normalise any movie shape (recommendation, search hit, local DB row) into the
// row shape the /watchlist and /favourites endpoints return.
const toShelfRow = (movie) => {
  if (typeof movie !== 'object' || movie === null) return { movie_id: movie, added_at: new Date().toISOString() };
  return {
    movie_id: movie.movieId ?? movie.movie_id,
    tmdb_id: movie.tmdbId ?? movie.tmdb_id ?? null,
    title: movie.title ?? '',
    year: movie.year ?? null,
    genres: movie.genres ?? '',
    added_at: new Date().toISOString(),
  };
};

// One saved list (watchlist or favourites): rows + id lookup + optimistic toggle.
const useShelf = (path, token, logout) => {
  const [items, setItems] = useState([]);
  const ids = useMemo(() => new Set(items.map((i) => i.movie_id)), [items]);

  const toggle = useCallback(async (movie) => {
    const row = toShelfRow(movie);
    const id = row.movie_id;
    if (id == null) return;

    const existing = items.find((i) => i.movie_id === id);
    const without = (list) => list.filter((i) => i.movie_id !== id);

    // Optimistic update
    setItems((prev) => (existing ? without(prev) : [row, ...without(prev)]));

    try {
      if (existing) {
        await apiFetch(`${path}/${id}`, { method: 'DELETE' }, token);
      } else {
        await apiFetch(path, { method: 'POST', body: JSON.stringify({ movie_id: id }) }, token);
      }
    } catch (err) {
      if (err.message === '__AUTH_EXPIRED__') { logout(); return; }
      // Revert on failure
      setItems((prev) => (existing ? [existing, ...without(prev)] : without(prev)));
    }
  }, [items, path, token, logout]);

  return { items, setItems, ids, toggle };
};

export const UserInteractionsProvider = ({ children }) => {
  const { user, token, logout } = useAuth();

  const [ratedMovies, setRatedMovies] = useState(new Map());
  const [lastInteractedMovie, setLastInteractedMovie] = useState(null);
  // Most recent thumbs-up, seeded from the stored rating history so it survives
  // logout / new sessions (unlike lastInteractedMovie, which is per-session).
  const [lastLikedMovie, setLastLikedMovie] = useState(null);
  const [listsLoading, setListsLoading] = useState(true);

  const watchlistShelf = useShelf('/api/users/watchlist', token, logout);
  const favouritesShelf = useShelf('/api/users/favourites', token, logout);
  const { setItems: setWatchlistItems } = watchlistShelf;
  const { setItems: setFavouriteItems } = favouritesShelf;

  // Initialize data on auth change
  useEffect(() => {
    if (!token || !user) {
      setWatchlistItems([]);
      setFavouriteItems([]);
      setRatedMovies(new Map());
      setLastInteractedMovie(null);
      setLastLikedMovie(null);
      setListsLoading(false);
      return;
    }

    let cancelled = false;

    const initData = async () => {
      setListsLoading(true);
      // Each list loads independently so one failing endpoint doesn't blank the others.
      const load = (path) => apiFetch(path, {}, token).then((res) => res.data || []);

      const [ratings, wl, fav] = await Promise.allSettled([
        load('/api/users/ratings'),
        load('/api/users/watchlist'),
        load('/api/users/favourites'),
      ]);
      if (cancelled) return;

      const failures = [ratings, wl, fav].filter((r) => r.status === 'rejected');
      if (failures.some((f) => f.reason?.message === '__AUTH_EXPIRED__')) { logout(); return; }
      failures.forEach((f) => console.error('Failed to init user interactions context:', f.reason));

      if (ratings.status === 'fulfilled') {
        const map = new Map();
        ratings.value.forEach((r) => map.set(r.movie_id, r.rating));
        setRatedMovies(map);
        // Rows arrive newest first; a rating of 4+ counts as a like.
        const liked = ratings.value.find((r) => r.rating >= 4);
        setLastLikedMovie(liked ? toShelfRow(liked) : null);
      }
      if (wl.status === 'fulfilled') setWatchlistItems(wl.value);
      if (fav.status === 'fulfilled') setFavouriteItems(fav.value);
      setListsLoading(false);
    };

    initData();
    return () => { cancelled = true; };
  }, [token, user, logout, setWatchlistItems, setFavouriteItems]);

  // Handle rating/feedback
  const handleFeedback = useCallback(async (movie, reward) => {
    const movieId = movie.movieId || movie.movie_id;
    const rating = reward === 1 ? 5.0 : 1.0;

    // Optimistic update
    setRatedMovies((prev) => new Map(prev).set(movieId, rating));

    // Fire-and-forget feedback to recommendation bandit and user ratings
    apiFetch('/api/recommendations/feedback', {
      method: 'POST',
      body: JSON.stringify({ movie_id: movieId, reward }),
    }, token).catch(() => { });

    apiFetch('/api/users/ratings', {
      method: 'POST',
      body: JSON.stringify({ movie_id: movieId, rating }),
    }, token).catch(() => { });

    // Track state for "Because you liked" feature globally
    if (reward === 1) {
      setLastInteractedMovie(movie);
      setLastLikedMovie(toShelfRow(movie));
    }

    return true;
  }, [token]);

  return (
    <UserInteractionsContext.Provider
      value={{
        // Watchlist — `watchlist` is a Set of movie ids, `watchlistItems` the full rows
        watchlist: watchlistShelf.ids,
        watchlistItems: watchlistShelf.items,
        toggleWatchlist: watchlistShelf.toggle,
        // Favourites
        favourites: favouritesShelf.ids,
        favouriteItems: favouritesShelf.items,
        toggleFavourite: favouritesShelf.toggle,
        listsLoading,
        ratedMovies,
        lastInteractedMovie,
        lastLikedMovie,
        handleFeedback,
      }}
    >
      {children}
    </UserInteractionsContext.Provider>
  );
};
