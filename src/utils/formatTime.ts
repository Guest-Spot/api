/**
 * Convert a 24-hour time string (HH:mm or HH:mm:ss) to a 12-hour AM/PM string.
 */
export const formatTimeToAmPm = (time?: string | null): string | null => {
  if (!time) {
    return null;
  }

  const trimmed = time.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/);

  if (!match) {
    return trimmed;
  }

  let hours = Number(match[1]);
  const minutes = match[2];

  if (Number.isNaN(hours) || hours < 0 || hours > 23) {
    return trimmed;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;

  const displayHours = hours === 0 ? 12 : hours;

  return `${displayHours}:${minutes} ${period}`;
};

