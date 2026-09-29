import React from 'react';
import { useTheme } from '../context/ThemeContext';

// Brand logo that swaps artwork with the active theme.
const Logo = ({ className = '' }) => {
  const { isDark } = useTheme();

  return (
    <img
      src={isDark ? '/logo_dark.png' : '/logo_light.png'}
      alt="Nth Watch"
      className={className}
    />
  );
};

export default Logo;
