import { useEffect, useState } from 'react';

// Grid columns for the "Card size" preference set in Settings (localStorage `cardSize`).
const GRID_COLS = {
  Compact: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7',
  Comfortable: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  Large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

const readCardSize = () => {
  try {
    return localStorage.getItem('cardSize') || 'Comfortable';
  } catch {
    return 'Comfortable';
  }
};

const useCardGrid = () => {
  const [cardSize, setCardSize] = useState(readCardSize);

  useEffect(() => {
    const handleStorageChange = () => setCardSize(readCardSize());
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return GRID_COLS[cardSize] || GRID_COLS.Comfortable;
};

export default useCardGrid;
