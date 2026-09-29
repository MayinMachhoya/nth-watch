import React from 'react'
import { Bookmark, Heart } from 'lucide-react'
import MovieShelf from '../components/MovieShelf'
import { useUserInteractions } from '../context/UserInteractionsContext'
import useDocumentTitle from '../hooks/useDocumentTitle'

const Watchlist = () => {
  useDocumentTitle('Watchlist')
  const { watchlistItems, toggleWatchlist, favourites, toggleFavourite, listsLoading } = useUserInteractions()

  return (
    <MovieShelf
      index="03"
      eyebrow="Saved for later"
      title="Watchlist"
      subtitle="Movies you want to watch later"
      icon={Bookmark}
      items={watchlistItems}
      loading={listsLoading}
      removeLabel="Remove from watchlist"
      onRemove={toggleWatchlist}
      cross={{
        icon: Heart,
        ids: favourites,
        onToggle: toggleFavourite,
        addLabel: 'Add to favourites',
        removeLabel: 'Remove from favourites',
      }}
      emptyTitle="Your watchlist is empty"
      emptyBody="Browse movies and tap the bookmark icon to add them here"
    />
  )
}

export default Watchlist
