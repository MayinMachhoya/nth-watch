import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Compass,
  Bookmark,
  Heart,
  Settings as SettingsIcon,
} from "lucide-react";
import Logo from "./Logo";

const Sidebar = () => {
  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Compass, label: "Find Your Movie", path: "/find" },
    { icon: Bookmark, label: "Watchlist", path: "/watchlist" },
    { icon: Heart, label: "Favourites", path: "/favourites" },
    { icon: SettingsIcon, label: "Settings", path: "/settings" },
  ];

  return (
    <aside className="hidden lg:flex relative z-dock w-sidebar bg-ink-deep flex-col shrink-0 border-r border-line h-full transition-colors duration-base">
      {/* Logo Area */}
      <NavLink
        to="/"
        className="block px-lg pt-xl pb-lg"
        aria-label="Nth Watch home"
      >
        <Logo className="w-logo-sidebar max-w-full h-auto" />
      </NavLink>

      <div className="px-lg">
        <div className="label text-fg-subtle border-b border-line pb-xs">
          Programme
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto no-scrollbar px-sm py-sm"
        aria-label="Primary"
      >
        <ol>
          {navItems.map((item, index) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `group relative flex items-center gap-sm pl-md pr-sm py-sm rounded-sm transition-colors duration-fast ${
                    isActive
                      ? "bg-surface text-fg"
                      : "text-fg-muted hover:text-fg hover:bg-surface"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute left-0 inset-y-xs w-rule rounded-xs transition-colors duration-fast ${isActive ? "bg-accent" : "bg-transparent"}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`font-mono text-micro tabular-nums ${isActive ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted"}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-medium text-small">
                      {item.label}
                    </span>
                    <item.icon
                      size={16}
                      strokeWidth={1.75}
                      className={
                        isActive
                          ? "text-accent"
                          : "text-fg-subtle group-hover:text-fg-muted"
                      }
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <div className="px-lg pb-lg space-y-2xs">
        <div className="label text-fg-subtle">Nth Watch</div>
        <p className="text-caption text-fg-subtle">
          Film data &amp; imagery from TMDB.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
