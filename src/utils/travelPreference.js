import { DAY_OF_WEEK_OPTIONS } from './dateOnly.js';

const LOCATION_LABELS = {
  NYC: 'New York',
  TAMPA: 'Tampa',
};

const PREFERRED_TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening'];

export function resolveRoute(from, to) {
  const origin = LOCATION_LABELS[from];
  const destination = LOCATION_LABELS[to];

  if (!origin || !destination) {
    throw new Error('Invalid route. Use NYC or TAMPA for from and to.');
  }
  if (from === to) {
    throw new Error('Origin and destination must be different.');
  }

  const direction = from === 'NYC' ? 'NYC_TAMPA' : 'TAMPA_NYC';

  return { origin, destination, direction };
}

export function formatPreferredDate(date) {
  if (!date) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatTravelPreference(preference) {
  const from = preference.direction === 'NYC_TAMPA' ? 'New York' : 'Tampa';
  const to = preference.direction === 'NYC_TAMPA' ? 'Tampa' : 'New York';

  const base = {
    id: preference.id,
    type: preference.isRecurring ? 'RECURRING' : 'ONE_TIME',
    from,
    to,
    route: `${from} → ${to}`,
    direction: preference.direction,
    origin: preference.origin,
    destination: preference.destination,
    preferredTime: preference.preferredTime,
    status: preference.status,
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt,
  };

  if (preference.isRecurring) {
    return {
      ...base,
      dayOfWeek: preference.dayOfWeek,
      day: preference.dayOfWeek,
      time: preference.preferredTime,
    };
  }

  return {
    ...base,
    preferredDate: preference.preferredDate,
    date: formatPreferredDate(preference.preferredDate),
    time: preference.preferredTime,
  };
}

export function groupTravelPreferences(preferences) {
  const formatted = preferences.map(formatTravelPreference);

  return {
    recurring: formatted.filter((preference) => preference.type === 'RECURRING'),
    oneTime: formatted.filter((preference) => preference.type === 'ONE_TIME'),
  };
}

export { DAY_OF_WEEK_OPTIONS, PREFERRED_TIME_OPTIONS };
