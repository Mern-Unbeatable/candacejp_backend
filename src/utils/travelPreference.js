import { DAY_OF_WEEK_OPTIONS, toDateKey } from './dateOnly.js';
import { formatDirectionLabel, formatMemberName } from './memberInterest.js';

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

export const TRAVEL_PREFERENCE_STATUSES = ['Interested', 'Confirmed', 'Canceled'];

export function normalizeTravelPreferenceStatus(status) {
  const map = {
    interested: 'Interested',
    confirmed: 'Confirmed',
    canceled: 'Canceled',
    cancelled: 'Canceled',
  };

  const normalized = map[status?.toLowerCase()];
  if (!normalized) {
    throw new Error('Invalid status. Use Interested, Confirmed, or Canceled.');
  }

  return normalized;
}

export function normalizeTravelPreferenceType(type) {
  if (!type || type.toLowerCase() === 'all') return null;

  const normalized = type.toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'recurring' || normalized === 'recurringtravel') return true;
  if (normalized === 'onetime' || normalized === 'onetimetravelrequests') return false;

  throw new Error('Invalid type filter. Use RECURRING or ONE_TIME.');
}

function formatListDate(date) {
  if (!date) return null;

  const [year, month, day] = toDateKey(date).split('-');
  return `${day}-${month}-${year}`;
}

export function formatRecurringDayLabel(dayOfWeek) {
  if (!dayOfWeek) return null;
  return dayOfWeek.endsWith('s') ? dayOfWeek.slice(0, -1) : dayOfWeek;
}

export function formatDepartureText(preference) {
  const time = preference.preferredTime || '';

  if (preference.isRecurring) {
    return `Every ${formatRecurringDayLabel(preference.dayOfWeek)}${time ? `, ${time}` : ''}`;
  }

  const dateStr = formatPreferredDate(preference.preferredDate);
  return `${dateStr}${time ? `, ${time}` : ''}`;
}

function formatUpcomingRoute(direction) {
  return formatDirectionLabel(direction)
    .replace('Tampa', 'TAMPA')
    .replace(' → ', ' >> ');
}

export function formatTravelPreferenceForUpcoming(preference, member) {
  const address = member
    ? [member.address, member.city, member.state, member.zipCode].filter(Boolean).join(', ')
    : null;

  return {
    id: preference.id,
    source: 'TRAVEL_PREFERENCE',
    route: formatUpcomingRoute(preference.direction),
    type: preference.isRecurring ? 'Recurring Travel' : 'One-Time Travel',
    departureDate: preference.isRecurring
      ? formatRecurringDayLabel(preference.dayOfWeek)
      : formatPreferredDate(preference.preferredDate),
    departureTime: preference.preferredTime,
    status: preference.status,
    passengers: member
      ? [{
          name: formatMemberName(member),
          email: member.email,
          phone: member.phone,
          address,
        }]
      : [],
    passengerCount: 1,
    direction: preference.direction,
    isRecurring: preference.isRecurring,
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt,
  };
}

export function formatStaffTravelPreferenceListItem(preference) {
  const route = formatDirectionLabel(preference.direction);

  return {
    id: preference.id,
    type: preference.isRecurring ? 'RECURRING' : 'ONE_TIME',
    route,
    date: preference.isRecurring
      ? formatRecurringDayLabel(preference.dayOfWeek)
      : formatListDate(preference.preferredDate),
    time: preference.preferredTime,
    status: preference.status,
    direction: preference.direction,
    dayOfWeek: preference.dayOfWeek,
    preferredDate: preference.preferredDate,
    memberId: preference.memberId,
    memberName: preference.member ? formatMemberName(preference.member) : null,
    createdAt: preference.createdAt,
  };
}

export function formatStaffTravelPreferenceDetails(preference) {
  const member = preference.member;
  const route = formatDirectionLabel(preference.direction);

  return {
    id: preference.id,
    type: preference.isRecurring ? 'RECURRING' : 'ONE_TIME',
    route,
    direction: preference.direction,
    status: preference.status,
    preferredTime: preference.preferredTime,
    dayOfWeek: preference.dayOfWeek,
    preferredDate: preference.preferredDate,
    departureText: formatDepartureText(preference),
    member: {
      id: member.id,
      name: formatMemberName(member),
      email: member.email,
      phone: member.phone,
      address: [member.address, member.city, member.state, member.zipCode]
        .filter(Boolean)
        .join(', ') || null,
    },
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt,
  };
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
