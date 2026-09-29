import React from 'react';
import { Player } from '@lottiefiles/react-lottie-player';

const LoadingSpinner = ({ text }) => {
  return (
    <div className="fixed inset-0 z-top bg-ink flex flex-col items-center justify-center gap-md transition-colors duration-base animate-fade" role="status" aria-live="polite">
      <div className="size-spinner">
        <Player
          autoplay
          loop
          src="/loading_spinner.json"
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      {text && (
        <p className="label text-fg-muted animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
