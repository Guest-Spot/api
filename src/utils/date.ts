/**
 * Utilities for working with date-only values stored as ISO strings (YYYY-MM-DD).
 * Strapi stores date-only values without timezone information; this helper ensures
 * we interpret them consistently as UTC to avoid timezone drift on servers.
 */

/**
 * Parse a date-only string into a Date instance interpreted in UTC.
 * Returns null when parsing fails.
 */
export function parseDateOnly(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = `${trimmed}T00:00:00Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date-only ISO string using the provided locale and options,
 * defaulting to a medium date in en-US. The output is rendered in UTC.
 */
export function formatDateOnly(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = 'en-US'
): string {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return value ?? 'Not specified';
  }

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(parsed);
}
