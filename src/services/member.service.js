import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import {
  formatOpportunityForMember,
  formatReservationForMember,
  getActivePassengerCount,
} from '../utils/reservation.js';
import {
  formatTravelPreference,
  formatTravelPreferenceForUpcoming,
  formatDepartureText,
  groupTravelPreferences,
  resolveRoute,
} from '../utils/travelPreference.js';
import { normalizePassenger, resolveCustomTravelRoute } from '../utils/customTravel.js';
import { formatCustomTravelForUpcoming } from '../utils/memberInterest.js';
import { formatDisplayDate, parseDateOnly, toDateKey } from '../utils/dateOnly.js';

const reservationInclude = {
  opportunity: true,
  passengers: {
    include: {
      passenger: true,
    },
  },
};

class MemberService {
  async getDashboardOverview(memberId) {
    const [travelOpportunities, pendingReservations, upcomingTripsData] = await Promise.all([
      prisma.opportunity.count({ where: { status: 'OPEN_FOR_RESERVATION' } }),
      prisma.reservation.count({ where: { memberId, status: 'PENDING' } }),
      this.getUpcomingTrips(memberId, 1, 3),
    ]);

    const upcomingTrips = upcomingTripsData.trips.map((trip) => ({
      id: trip.id,
      source: trip.source,
      route: trip.route,
      time: trip.departureTime
        ? `${trip.departureDate}, ${trip.departureTime}`
        : (trip.departureDate instanceof Date ? formatDisplayDate(trip.departureDate) : String(trip.departureDate)),
      type: trip.type,
    }));

    const upcomingTripsCount = upcomingTripsData.pagination.total;

    const [preferences, customRequests, confirmedOpportunities] = await Promise.all([
      prisma.travelPreference.findMany({
        select: {
          direction: true,
          dayOfWeek: true,
          preferredTime: true,
          preferredDate: true,
          memberId: true,
        },
      }),
      prisma.customTravelRequest.findMany({
        select: {
          direction: true,
          departureDate: true,
          memberId: true,
        },
      }),
      prisma.opportunity.findMany({
        where: { status: 'CONFIRMED' },
        select: {
          direction: true,
          departureDate: true,
        },
      }),
    ]);

    const directionLabel = (direction) => (direction === 'NYC_TAMPA' ? 'NYC → Tampa' : 'Tampa → NYC');
    const normalizeDow = (value) => value?.replace(/s$/i, '') || 'Flexible';
    const normalizeTime = (value) => {
      if (!value) return 'Anytime';
      if (value === 'Morning') return 'Mornings';
      if (value === 'Evening') return 'Evenings';
      if (value === 'Afternoon') return 'Afternoons';
      return value;
    };

    const routeTimeCounts = new Map();
    const totalRouteTimeEntries = preferences.length + customRequests.length || 1;

    preferences.forEach((item) => {
      const key = `${item.direction}|${normalizeDow(item.dayOfWeek)} ${normalizeTime(item.preferredTime)}`;
      routeTimeCounts.set(key, (routeTimeCounts.get(key) || 0) + 1);
    });

    customRequests.forEach((item) => {
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(item.departureDate);
      const key = `${item.direction}|${weekday} Anytime`;
      routeTimeCounts.set(key, (routeTimeCounts.get(key) || 0) + 1);
    });

    const highDemandRoutes = [...routeTimeCounts.entries()]
      .map(([key, count]) => {
        const [direction, time] = key.split('|');
        const percentage = Math.round((count / totalRouteTimeEntries) * 100);
        return {
          route: directionLabel(direction),
          time,
          stat: `+${percentage}%`,
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map(({ route, time, stat }) => ({ route, time, stat }));

    const dateCounts = new Map();
    const addDateHit = (date, memberIdValue = null) => {
      if (!date) return;
      const key = toDateKey(date);
      const current = dateCounts.get(key) || { routes: 0, members: new Set() };
      current.routes += 1;
      if (memberIdValue) current.members.add(memberIdValue);
      dateCounts.set(key, current);
    };

    preferences.forEach((item) => addDateHit(item.preferredDate, item.memberId));
    customRequests.forEach((item) => addDateHit(item.departureDate, item.memberId));
    confirmedOpportunities.forEach((item) => addDateHit(item.departureDate));

    const popularTravelDates = [...dateCounts.entries()]
      .map(([dateKey, metrics]) => ({
        date: formatDisplayDate(new Date(`${dateKey}T12:00:00.000Z`)),
        details: `${metrics.routes} routes · ${metrics.members.size || metrics.routes} members`,
        score: metrics.routes + metrics.members.size,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ date, details }) => ({ date, details }));

    return {
      stats: {
        travelOpportunities,
        pendingReservations,
        upcomingTrips: upcomingTripsCount,
      },
      demandInsights: {
        highDemandRoutes,
        popularTravelDates,
      },
      upcomingTrips,
    };
  }

  async getAvailableOpportunities(memberId, page = 1, limit = 10, filters = {}) {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * perPage;

    const where = {
      status: 'OPEN_FOR_RESERVATION',
      ...(filters.direction ? { direction: filters.direction } : {}),
    };

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { departureDate: 'asc' },
      }),
      prisma.opportunity.count({ where }),
    ]);

    const opportunityIds = opportunities.map((opportunity) => opportunity.id);

    const memberReservations = opportunityIds.length
      ? await prisma.reservation.findMany({
          where: {
            memberId,
            opportunityId: { in: opportunityIds },
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          select: {
            id: true,
            opportunityId: true,
            status: true,
          },
        })
      : [];

    const reservationByOpportunity = new Map(
      memberReservations.map((reservation) => [reservation.opportunityId, reservation])
    );

    const opportunitiesWithSeats = await Promise.all(
      opportunities.map(async (opportunity) => {
        const bookedSeats = await getActivePassengerCount(prisma, opportunity.id);
        const memberReservation = reservationByOpportunity.get(opportunity.id) ?? null;
        return formatOpportunityForMember(opportunity, bookedSeats, memberReservation);
      })
    );

    return {
      opportunities: opportunitiesWithSeats,
      pagination: buildPagination(currentPage, perPage, total),
    };
  }

  async placeReservation(memberId, opportunityId) {
    const member = await prisma.user.findUnique({ where: { id: memberId } });
    if (!member || member.role !== 'MEMBER') {
      throw new Error('Only active members can place reservations');
    }
    if (member.status !== 'ACTIVE') {
      throw new Error('Your account must be active before placing a reservation');
    }
    if (!member.firstName || !member.lastName) {
      throw new Error('Please complete your profile before placing a reservation');
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      throw new Error('Opportunity not found');
    }
    if (opportunity.status !== 'OPEN_FOR_RESERVATION') {
      throw new Error('This opportunity is not open for reservation');
    }

    const existingReservation = await prisma.reservation.findFirst({
      where: {
        memberId,
        opportunityId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (existingReservation) {
      throw new Error('You already have an active reservation for this opportunity');
    }

    const bookedSeats = await getActivePassengerCount(prisma, opportunityId);
    const availableSeats = opportunity.totalCapacity - bookedSeats;

    if (availableSeats < 1) {
      throw new Error('No seats available on this flight');
    }

    const memberAddress = [member.address, member.city, member.state, member.zipCode]
      .filter(Boolean)
      .join(', ');

    await prisma.reservation.create({
      data: {
        memberId,
        opportunityId,
        status: 'PENDING',
        passengers: {
          create: {
            passenger: {
              create: {
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                phone: member.phone,
                address: memberAddress || null,
              },
            },
          },
        },
      },
    });
  }

  async getPendingReservations(memberId, page = 1, limit = 10) {
    return this.getMemberReservationsByStatus(memberId, 'PENDING', page, limit);
  }

  async getUpcomingTrips(memberId, page = 1, limit = 10) {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, parseInt(limit, 10) || 10);

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    const [reservations, preferences, customTravels] = await Promise.all([
      prisma.reservation.findMany({
        where: { memberId, status: 'CONFIRMED' },
        orderBy: { createdAt: 'desc' },
        include: reservationInclude,
      }),
      prisma.travelPreference.findMany({
        where: { memberId, status: 'Confirmed' },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.customTravelRequest.findMany({
        where: { memberId, status: 'CONFIRMED' },
        orderBy: { updatedAt: 'desc' },
        include: { passengers: true },
      }),
    ]);

    const trips = [
      ...reservations.map((reservation) => ({
        ...formatReservationForMember(reservation),
        source: 'RESERVATION',
        sortDate: reservation.createdAt,
      })),
      ...preferences.map((preference) => ({
        ...formatTravelPreferenceForUpcoming(preference, member),
        sortDate: preference.updatedAt,
      })),
      ...customTravels.map((request) => ({
        ...formatCustomTravelForUpcoming(request),
        sortDate: request.updatedAt,
      })),
    ].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    const total = trips.length;
    const skip = (currentPage - 1) * perPage;
    const paginatedTrips = trips
      .slice(skip, skip + perPage)
      .map(({ sortDate, ...trip }) => trip);

    return {
      trips: paginatedTrips,
      pagination: buildPagination(currentPage, perPage, total),
    };
  }

  async getMemberReservationsByStatus(memberId, status, page = 1, limit = 10) {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * perPage;

    const where = { memberId, status };

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: reservationInclude,
      }),
      prisma.reservation.count({ where }),
    ]);

    return {
      reservations: reservations.map(formatReservationForMember),
      pagination: buildPagination(currentPage, perPage, total),
    };
  }

  async getReservationDetails(memberId, reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: reservationId,
        memberId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: reservationInclude,
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    return {
      ...formatReservationForMember(reservation),
      source: 'RESERVATION',
    };
  }

  async getTravelPreferenceDetails(memberId, preferenceId) {
    const preference = await prisma.travelPreference.findFirst({
      where: { id: preferenceId, memberId },
    });

    if (!preference) {
      throw new Error('Travel preference not found');
    }

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    return {
      ...formatTravelPreferenceForUpcoming(preference, member),
      departureText: formatDepartureText(preference),
    };
  }

  async getCustomTravelDetails(memberId, requestId) {
    const request = await prisma.customTravelRequest.findFirst({
      where: { id: requestId, memberId, status: 'CONFIRMED' },
      include: { passengers: true },
    });

    if (!request) {
      throw new Error('Custom travel request not found');
    }

    return formatCustomTravelForUpcoming(request);
  }

  async cancelReservation(memberId, reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, memberId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }
    if (reservation.status !== 'PENDING') {
      throw new Error('Only pending reservations can be cancelled');
    }

    const cancelled = await prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED' },
      include: reservationInclude,
    });

    return formatReservationForMember(cancelled);
  }

  async getTravelPreferences(memberId) {
    const preferences = await prisma.travelPreference.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
    });

    return groupTravelPreferences(preferences);
  }

  async createTravelPreference(memberId, payload) {
    const { origin, destination, direction } = resolveRoute(payload.from, payload.to);

    const preference = await prisma.travelPreference.create({
      data: {
        memberId,
        isRecurring: payload.type === 'RECURRING',
        direction,
        origin,
        destination,
        dayOfWeek: payload.type === 'RECURRING' ? payload.dayOfWeek : null,
        preferredDate: payload.type === 'ONE_TIME' ? new Date(payload.preferredDate) : null,
        preferredTime: payload.preferredTime,
      },
    });

    return formatTravelPreference(preference);
  }

  async deleteTravelPreference(memberId, preferenceId) {
    const preference = await prisma.travelPreference.findFirst({
      where: { id: preferenceId, memberId },
    });

    if (!preference) {
      throw new Error('Travel preference not found');
    }

    await prisma.travelPreference.delete({
      where: { id: preferenceId },
    });
  }

  async createCustomTravelRequest(memberId, payload) {
    const member = await prisma.user.findUnique({ where: { id: memberId } });
    if (!member || member.role !== 'MEMBER') {
      throw new Error('Only members can submit custom travel requests');
    }
    if (member.status !== 'ACTIVE') {
      throw new Error('Your account must be active before submitting a custom travel request');
    }

    const outbound = resolveCustomTravelRoute(payload.origin, payload.destination);
    const returnLeg =
      payload.tripType === 'ROUND_TRIP'
        ? resolveCustomTravelRoute(payload.returnOrigin, payload.returnDestination)
        : null;

    await prisma.customTravelRequest.create({
      data: {
        memberId,
        tripType: payload.tripType,
        direction: outbound.direction,
        origin: outbound.origin,
        destination: outbound.destination,
        returnDirection: returnLeg?.direction ?? null,
        returnOrigin: returnLeg?.origin ?? null,
        returnDestination: returnLeg?.destination ?? null,
        departureDate: parseDateOnly(payload.departureDate),
        returnDate: payload.tripType === 'ROUND_TRIP' ? parseDateOnly(payload.returnDate) : null,
        passengerCount: payload.passengerCount,
        specialRequests: payload.specialRequests?.trim() || null,
        passengers: {
          create: payload.passengers.map(normalizePassenger),
        },
      },
    });
  }
}

export default new MemberService();
