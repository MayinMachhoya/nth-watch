import { useEffect } from 'react';

const SITE_NAME = 'Nth Watch';
const DEFAULT_TITLE = `${SITE_NAME} — Personalised Movie Recommendations`;

// Sets the tab title for the current page; pass nothing for the site default.
const useDocumentTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  }, [title]);
};

export default useDocumentTitle;
