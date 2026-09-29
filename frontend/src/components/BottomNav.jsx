import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Bookmark, Heart, Settings as SettingsIcon } from 'lucide-react';

const BottomNav = () => {
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Compass, label: 'Find', path: '/find' },
    { icon: Bookmark, label: 'Watchlist', path: '/watchlist' },
    { icon: Heart, label: 'Favourites', path: '/favourites' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-dock bg-ink-deep border-t border-line pb-xs transition-colors duration-base">
      <nav className="grid grid-cols-5 w-full" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center w-full gap-2xs pt-sm pb-xs transition-colors duration-fast ${isActive ? 'text-fg' : 'text-fg-subtle hover:text-fg'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute top-0 inset-x-md h-rule transition-colors duration-fast ${isActive ? 'bg-accent' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
                <item.icon size={20} strokeWidth={1.75} className={isActive ? 'text-accent' : ''} />
                <span className="text-micro font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default BottomNav;
