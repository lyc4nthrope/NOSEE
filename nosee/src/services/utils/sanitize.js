import DOMPurify from 'dompurify';

export function sanitizeHTML(dirty) {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
