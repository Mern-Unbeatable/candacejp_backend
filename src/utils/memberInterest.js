import {
  formatDisplayDate,
  formatShortDate,
  matchesWeekdayLabel,
  parseDateOnly,
  toDateKey,
} from './dateOnly.js';

export { formatDisplayDate, formatShortDate, toDateKey };

/** Format a stored calendar date as M/D/YYYY without timezone day-shift. */
export function formatCalendarDate(date) {
  if (!date) return null;

  const [year, month, day] = toDateKey(date).split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

export function formatDirectionLabel(direction) {
  if (direction === 'NYC_TAMPA') return 'NYC → Tampa';
  if (direction === 'TAMPA_NYC') return 'Tampa → NYC';
  return direction;
}

export function formatTripTypeLabel(tripType) {
  if (tripType === 'ROUND_TRIP') return 'Round Trip';
  return 'One Way Trip';
}

export function formatTripTypeListLabel(tripType) {
  if (tripType === 'ROUND_TRIP') return 'Round Trip';
  return 'One Way';
}

export function formatInterestStatus(status) {
  if (status === 'CONFIRMED') return 'Confirm';
  return 'Interested';
}

export function getDemandLevel(count) {
  if (count >= 5) return 'high';
  if (count >= 3) return 'medium';
  if (count >= 1) return 'low';
  return 'none';
}

export function getRouteLabel(directions) {
  const uniqueDirections = [...new Set(directions.filter(Boolean))];

  if (uniqueDirections.length === 0) return null;
  if (uniqueDirections.length > 1) return 'Mixed Demand';
  return formatDirectionLabel(uniqueDirections[0]);
}

export function getDayBounds(dateString) {
  const start = new Date(`${dateString}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function getMonthBounds(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function getRangeBounds(startDate, endDate) {
  const { start } = getDayBounds(startDate);
  const { end } = getDayBounds(endDate);
  return { start, end };
}

export function matchesRecurringDay(date, dayOfWeek) {
  return matchesWeekdayLabel(date, dayOfWeek);
}

export function formatMemberName(member) {
  const name = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();
  return name || member?.email || 'Unknown Member';
}

export function formatCustomTravelInterest(request) {
  const member = request.member;
  const route = formatDirectionLabel(request.direction);
  const returnRoute = request.returnDirection
    ? formatDirectionLabel(request.returnDirection)
    : null;
  const departure = formatCalendarDate(request.departureDate);
  const returnDeparture = formatCalendarDate(request.returnDate);

  return {
    id: request.id,
    source: 'CUSTOM_TRAVEL',
    memberId: member.id,
    memberName: formatMemberName(member),
    memberEmail: member.email,
    route: request.tripType === 'ROUND_TRIP' && returnRoute
      ? `${route}, ${returnRoute}`
      : route,
    outboundRoute: route,
    returnRoute,
    direction: request.direction,
    returnDirection: request.returnDirection ?? null,
    tripType: request.tripType,
    tripTypeLabel: formatTripTypeLabel(request.tripType),
    status: formatInterestStatus(request.status),
    interestStatus: request.status,
    departureDate: request.departureDate,
    departureDateFormatted: departure,
    departure,
    returnDate: request.returnDate,
    returnDateFormatted: returnDeparture,
    returnDeparture,
    scheduleLabel: 'Departure',
    scheduleText: returnDeparture
      ? `Departure: ${departure}, Return Departure: ${returnDeparture}`
      : `Departure: ${departure}`,
    passengerCount: request.passengerCount,
    passengers: request.passengerCount,
  };
}

export function formatMemberInterestListItem(request) {
  const member = request.member;
  const route = formatDirectionLabel(request.direction);

  return {
    id: request.id,
    name: formatMemberName(member),
    email: member.email,
    departure: toDateKey(request.departureDate),
    direction: route,
    type: formatTripTypeListLabel(request.tripType),
    passengers: request.passengerCount,
    status: formatInterestStatus(request.status),
    interestStatus: request.status,
    tripType: request.tripType,
    memberId: member.id,
    createdAt: request.createdAt,
  };
}

export function formatTravelPreferenceInterest(preference) {
  const member = preference.member;

  return {
    id: preference.id,
    source: 'TRAVEL_PREFERENCE',
    memberId: member.id,
    memberName: formatMemberName(member),
    memberEmail: member.email,
    route: formatDirectionLabel(preference.direction),
    direction: preference.direction,
    tripType: preference.isRecurring ? 'RECURRING' : 'ONE_TIME',
    tripTypeLabel: preference.isRecurring ? 'Recurring Travel' : 'One Way Trip',
    status: preference.status?.toUpperCase() || 'INTERESTED',
    preferredDate: preference.preferredDate,
    preferredDateFormatted: formatShortDate(preference.preferredDate),
    dayOfWeek: preference.dayOfWeek,
    preferredTime: preference.preferredTime,
    scheduleLabel: preference.isRecurring ? 'Regular' : 'Departure',
    passengerCount: 1,
  };
}

export function buildRouteSummary(interests) {
  const counts = interests.reduce((acc, interest) => {
    const label = interest.outboundRoute || interest.route;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([route, count]) => ({ route, count }));
}
