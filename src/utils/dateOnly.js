// US Eastern — flights are NYC ↔ Tampa
export const US_TIME_ZONE = 'America/New_York';

/** JavaScript Date.getUTCDay() index (0 = Sunday … 6 = Saturday). */
const WEEKDAY_INDEX_TO_LABEL = {
  0: 'Sundays',
  1: 'Mondays',
  2: 'Tuesdays',
  3: 'Wednesdays',
  4: 'Thursdays',
  5: 'Fridays',
  6: 'Saturdays',
};

/** UI / API display order — week starts on Monday. */
export const WEEK_DAYS_MONDAY_FIRST = [
  { day: 'Mon', index: 1 },
  { day: 'Tue', index: 2 },
  { day: 'Wed', index: 3 },
  { day: 'Thu', index: 4 },
  { day: 'Fri', index: 5 },
  { day: 'Sat', index: 6 },
  { day: 'Sun', index: 0 },
];

export const DAY_OF_WEEK_OPTIONS = WEEK_DAYS_MONDAY_FIRST.map(
  ({ index }) => WEEKDAY_INDEX_TO_LABEL[index]
);

/**
 * Parse a date-only value (YYYY-MM-DD) as noon UTC on that calendar day.
 * Avoids timezone shifts when the server runs outside the US (e.g. BD).
 */
export function parseDateOnly(value) {
  if (!value) return null;

  const datePart = String(value).split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  if (!year || !month || !day) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Calendar date key (YYYY-MM-DD) from a stored timestamp. */
export function toDateKey(date) {
  if (!date) return null;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date, timeZone = US_TIME_ZONE) {
  if (!date) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(date, timeZone = US_TIME_ZONE) {
  if (!date) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateLabel(dateString, timeZone = US_TIME_ZONE) {
  const date = parseDateOnly(dateString);

  return date.toLocaleDateString('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function getUtcWeekdayIndex(date) {
  return date.getUTCDay();
}

export function getWeekdayLabel(date) {
  return WEEKDAY_INDEX_TO_LABEL[date.getUTCDay()];
}

export function matchesWeekdayLabel(date, dayOfWeek) {
  if (!dayOfWeek) return false;
  return getWeekdayLabel(date) === dayOfWeek;
}
