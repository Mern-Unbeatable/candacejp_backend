import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import {
  formatOpportunityForMember,
  formatReservationForMember,
  getActivePassengerCount,
} from '../utils/reservation.js';
import {
  formatTravelPreference,
  groupTravelPreferences,
  resolveRoute,
} from '../utils/travelPreference.js';

const reservationInclude = {
  opportunity: true,
  passengers: {
    include: {
      passenger: true,
    },
  },
};

class MemberService {
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
    return this.getMemberReservationsByStatus(memberId, 'CONFIRMED', page, limit);
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

    return formatReservationForMember(reservation);
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
}

export default new MemberService();
