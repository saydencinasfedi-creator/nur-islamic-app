import React from 'react';

// Paints the camera-cutout safe-area strip opaque even once a sticky header below it
// has scrolled up against it — same fix as Quran.tsx's reader header, otherwise
// scrolled content shows through that strip. Must be `fixed` (not `absolute`) so it
// stays pinned to the true viewport regardless of this page's own scroll position.
const SafeAreaTopFiller: React.FC = () => (
  <div
    className="fixed top-0 left-0 right-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm"
    style={{ height: 'calc(env(safe-area-inset-top, 0px) + 1px)' }}
  />
);

export default SafeAreaTopFiller;
