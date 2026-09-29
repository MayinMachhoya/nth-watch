import React from 'react'
import { Bookmark, Heart } from 'lucide-react'
import MovieShelf from '../components/MovieShelf'
import { useUserInteractions } from '../context/UserInteractionsContext'
import useDocumentTitle from '../hooks/useDocumentTitle'

const Favourites = () => {
  useDocumentTitle('Favourites')
  const { favouriteItems, toggleFavourite, watchlist, toggleWatchlist, listsLoading } = useUserInteractions()

  return (
    <MovieShelf
      index="04"
      eyebrow="The keepers"
      title="Favourites"
      subtitle="Your favourite movies collection"
      icon={Heart}
      items={favouriteItems}
      loading={listsLoading}
      removeLabel="Remove from favourites"
      onRemove={toggleFavourite}
      cross={{
        icon: Bookmark,
        ids: watchlist,
        onToggle: toggleWatchlist,
        addLabel: 'Add to watchlist',
        removeLabel: 'Remove from watchlist',
      }}
      emptyTitle="No favourites yet"
      emptyBody="Heart movies you love to build your collection"
    />
  )
}

export default Favourites
