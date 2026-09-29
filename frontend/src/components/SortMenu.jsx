import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';

// Compact themed dropdown: "Sort / Recently added ▾" with a listbox popover.
const SortMenu = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const listId = useId();

  const activeIndex = Math.max(0, options.findIndex((o) => o.key === value));
  const current = options[activeIndex];

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Move focus into the list when it opens
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const select = (key) => {
    onChange(key);
    setOpen(false);
  };

  const handleListKey = (e, i) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) {
      e.preventDefault();
      optionRefs.current[(i + step + options.length) % options.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex items-center gap-xs h-control px-sm rounded-xs border text-small transition-colors duration-fast ${open
          ? 'border-accent text-fg bg-surface'
          : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
          }`}
      >
        <ArrowUpDown size={14} className="text-fg-subtle" />
        <span className="label text-fg-subtle hidden sm:inline">Sort /</span>
        <span className="font-medium text-fg">{current.label}</span>
        <ChevronDown size={14} className={`text-fg-subtle transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sort by"
          className="absolute right-0 top-full mt-2xs z-dropdown min-w-field-sm py-2xs bg-surface-raised border border-line-strong rounded-sm shadow-lift animate-fade"
        >
          {options.map((opt, i) => {
            const selected = opt.key === value;
            return (
              <li key={opt.key} role="presentation">
                <button
                  ref={(el) => { optionRefs.current[i] = el; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(opt.key)}
                  onKeyDown={(e) => handleListKey(e, i)}
                  className={`w-full flex items-center justify-between gap-md px-sm h-control-sm text-left text-small transition-colors duration-fast focus-visible:outline-none focus-visible:bg-surface-hover hover:bg-surface-hover ${selected ? 'text-fg' : 'text-fg-muted'}`}
                >
                  {opt.label}
                  {selected && <Check size={14} className="text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SortMenu;
