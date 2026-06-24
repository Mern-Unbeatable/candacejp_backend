import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import { getActivePassengerCount } from '../utils/reservation.js';

const OPPORTUNITY_STATUSES = ['DRAFT', 'OPEN_FOR_RESERVATION', 'CONFIRMED', 'COMPLETED'];

function buildOpportunityWhere({ direction, status }) {
    const where = {};

    if (direction) {
        where.direction = direction;
    }

    if (status && status.toLowerCase() !== 'all') {
        const normalizedStatus = status.toUpperCase();
        if (!OPPORTUNITY_STATUSES.includes(normalizedStatus)) {
            throw new Error('Invalid status filter. Use all, DRAFT, OPEN_FOR_RESERVATION, CONFIRMED, or COMPLETED.');
        }
        where.status = normalizedStatus;
    }

    return where;
}

function formatOpportunityRow(opportunity) {
    const totalBooked = opportunity.bookedSeats ?? 0;
    const { bookedSeats, reservations, ...rest } = opportunity;

    return {
        ...rest,
        totalSeat: rest.totalCapacity,
        totalBooked,
        availableSeat: Math.max(rest.totalCapacity - totalBooked, 0),
    };
}

class StaffService {
    // Helper to determine direction
    determineDirection(origin, destination) {
        const o = origin.toLowerCase();
        const d = destination.toLowerCase();
        if (o.includes('nyc') || o.includes('teb') || o.includes('jfk')) return 'NYC_TAMPA';
        if (o.includes('tampa')) return 'TAMPA_NYC';
        return 'NYC_TAMPA'; // Default
    }
    async createOpportunity(data, createdById) {
        return await prisma.opportunity.create({
          data: {
            direction: this.determineDirection(data.origin, data.destination),
            origin: data.origin,
            destination: data.destination,
            tripType: data.tripType,
            departureDate: new Date(data.departureDate),
            returnDate: data.returnDate ? new Date(data.returnDate) : null,
            estimatedPrice: data.estimatedPrice,
            aircraftType: data.aircraftType || null,
            totalCapacity: data.totalCapacity,
            status: data.status || 'DRAFT',
            createdById,
          },
        });
      }

    async getAllOpportunities(page = 1, limit = 10, filters = {}) {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const perPage = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * perPage;
        const where = buildOpportunityWhere(filters);

        const [opportunities, total] = await Promise.all([
            prisma.opportunity.findMany({
                where,
                skip,
                take: perPage,
                orderBy: { departureDate: 'asc' },
            }),
            prisma.opportunity.count({ where }),
        ]);

        const opportunitiesWithSeats = await Promise.all(
            opportunities.map(async (opportunity) => ({
                ...opportunity,
                bookedSeats: await getActivePassengerCount(prisma, opportunity.id),
            }))
        );

        return {
            opportunities: opportunitiesWithSeats.map(formatOpportunityRow),
            pagination: buildPagination(currentPage, perPage, total),
        };
    }

    async getOpportunityDetails(id) {
        return await prisma.opportunity.findUnique({ where: { id } });
    }

    async editDraftOpportunity(id, data) {
        const opp = await prisma.opportunity.findUnique({ where: { id } });
        if (!opp) throw new Error('Opportunity not found');
        if (opp.status !== 'DRAFT') throw new Error('Only DRAFT opportunities can be edited');

        const origin = data.origin ?? opp.origin;
        const destination = data.destination ?? opp.destination;

        const updateData = {
            ...(data.origin !== undefined && { origin: data.origin }),
            ...(data.destination !== undefined && { destination: data.destination }),
            ...(data.tripType !== undefined && { tripType: data.tripType }),
            ...(data.departureDate !== undefined && { departureDate: new Date(data.departureDate) }),
            ...(data.returnDate !== undefined && {
                returnDate: data.returnDate ? new Date(data.returnDate) : null,
            }),
            ...(data.estimatedPrice !== undefined && { estimatedPrice: data.estimatedPrice }),
            ...(data.aircraftType !== undefined && { aircraftType: data.aircraftType || null }),
            ...(data.totalCapacity !== undefined && { totalCapacity: data.totalCapacity }),
        };

        if (data.origin !== undefined || data.destination !== undefined) {
            updateData.direction = this.determineDirection(origin, destination);
        }

        return await prisma.opportunity.update({ where: { id }, data: updateData });
    }

    async publishOpportunity(id) {
        const opp = await prisma.opportunity.findUnique({ where: { id } });
        if (opp?.status !== 'DRAFT') throw new Error('Only DRAFT opportunities can be published');

        return await prisma.opportunity.update({
            where: { id },
            data: { status: 'OPEN_FOR_RESERVATION' }
        });
    }

    async updateReservationStatus(id, newStatus) {
        const allowedTransitions = {
            OPEN_FOR_RESERVATION: ['CONFIRMED', 'COMPLETED'],
            CONFIRMED: ['COMPLETED'],
        };

        const opp = await prisma.opportunity.findUnique({ where: { id } });
        if (!opp) {
            throw new Error('Opportunity not found');
        }

        const allowedNextStatuses = allowedTransitions[opp.status];
        if (!allowedNextStatuses?.includes(newStatus)) {
            throw new Error(
                `Cannot change status from ${opp.status} to ${newStatus}. ` +
                (opp.status === 'OPEN_FOR_RESERVATION'
                    ? 'Allowed next statuses: CONFIRMED or COMPLETED.'
                    : opp.status === 'CONFIRMED'
                        ? 'Only COMPLETED is allowed from CONFIRMED.'
                        : 'This opportunity cannot be updated via this endpoint.')
            );
        }

        return await prisma.opportunity.update({ where: { id }, data: { status: newStatus } });
    }
}
export default new StaffService();