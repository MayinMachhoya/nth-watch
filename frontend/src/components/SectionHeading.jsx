import React from 'react';

// Numbered editorial heading: "01 / Genres" mono eyebrow, serif title, hairline rule.
const SectionHeading = ({ index, eyebrow, title, action, as = 'h2', className = '' }) => {
  const Tag = as;

  return (
    <div className={`flex items-end justify-between gap-md border-b border-line pb-sm mb-lg ${className}`}>
      <div className="min-w-0">
        {(index || eyebrow) && (
          <div className="label text-fg-subtle mb-xs">
            {index && <span className="text-accent">{index}</span>}
            {index && eyebrow && <span> / </span>}
            {eyebrow}
          </div>
        )}
        {title && (
          <Tag className="font-display text-section text-fg tracking-tight truncate">
            {title}
          </Tag>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default SectionHeading;
