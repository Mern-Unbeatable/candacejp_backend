import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import { getActivePassengerCount } from '../utils/reservation.js';
import {
    buildRouteSummary,
    formatCustomTravelInterest,
    formatDirectionLabel,
    formatDisplayDate,
    formatMemberName,
    formatTripTypeLabel,
    getDayBounds,
    getDemandLevel,
    getMonthBounds,
    getRangeBounds,
    getRouteLabel,
    toDateKey,
} from '../utils/memberInterest.js';
import { formatDateLabel, getUtcWeekdayIndex, WEEK_DAYS_MONDAY_FIRST } from '../utils/dateOnly.js';

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

    buildInterestDirectionFilter(direction) {
        if (!direction) return {};
        return { direction };
    }

    async fetchInterestRecords({ start, end, direction }) {
        const directionFilter = this.buildInterestDirectionFilter(direction);

        const customTravels = await prisma.customTravelRequest.findMany({
            where: {
                ...directionFilter,
                departureDate: { gte: start, lt: end },
            },
            include: {
                member: {
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
                },
                passengers: true,
            },
            orderBy: { departureDate: 'asc' },
        });

        return customTravels.map((request) => ({
            dateKey: toDateKey(request.departureDate),
            direction: request.direction,
            interest: formatCustomTravelInterest(request),
            raw: request,
        }));
    }

    async getDashboardSummary() {
        const [customTravelCount, scheduledFlights, customTravels] = await Promise.all([
            prisma.customTravelRequest.count(),
            prisma.opportunity.count({ where: { status: 'CONFIRMED' } }),
            prisma.customTravelRequest.findMany({ select: { direction: true, departureDate: true } }),
        ]);

        const weeklyCounts = Array(7).fill(0);
        const routeCounts = { NYC_TAMPA: 0, TAMPA_NYC: 0 };

        customTravels.forEach((item) => {
            weeklyCounts[getUtcWeekdayIndex(item.departureDate)] += 1;
            routeCounts[item.direction] += 1;
        });

        const totalWeeklyMembers = weeklyCounts.reduce((sum, count) => sum + count, 0);
        const totalRouteCount = routeCounts.NYC_TAMPA + routeCounts.TAMPA_NYC || 1;

        return {
            totalInterest: customTravelCount,
            scheduledFlights,
            weeklyDemandTrend: WEEK_DAYS_MONDAY_FIRST.map(({ day, index }) => ({
                day,
                members: weeklyCounts[index],
                percentage: totalWeeklyMembers === 0
                    ? 0
                    : Math.round((weeklyCounts[index] / totalWeeklyMembers) * 100),
            })),
            popularRoutes: [
                {
                    route: 'NYC → Tampa',
                    count: routeCounts.NYC_TAMPA,
                    percentage: Math.round((routeCounts.NYC_TAMPA / totalRouteCount) * 100),
                },
                {
                    route: 'Tampa → NYC',
                    count: routeCounts.TAMPA_NYC,
                    percentage: Math.round((routeCounts.TAMPA_NYC / totalRouteCount) * 100),
                },
            ],
        };
    }

    async getDashboardCalendar(filters = {}) {
        const { month, year, startDate, endDate, direction, date, interestId } = filters;

        if (interestId) {
            return this.getInterestDetails(interestId);
        }

        let bounds;
        if (date) {
            bounds = getDayBounds(date);
        } else if (startDate && endDate) {
            if (startDate > endDate) {
                throw new Error('From date must be on or before to date.');
            }
            bounds = getRangeBounds(startDate, endDate);
        } else {
            const resolvedYear = parseInt(year, 10) || new Date().getUTCFullYear();
            const resolvedMonth = parseInt(month, 10) || new Date().getUTCMonth() + 1;
            bounds = getMonthBounds(resolvedYear, resolvedMonth);
        }

        const datedInterests = await this.fetchInterestRecords({
            start: bounds.start,
            end: bounds.end,
            direction,
        });

        if (date) {
            const interests = datedInterests
                .filter((item) => item.dateKey === date)
                .map((item) => item.interest);

            return {
                date,
                dateLabel: formatDateLabel(date),
                totalInterested: interests.length,
                routeSummary: buildRouteSummary(interests),
                interests,
            };
        }

        const dayMap = new Map();

        datedInterests.forEach((item) => {
            if (!dayMap.has(item.dateKey)) {
                dayMap.set(item.dateKey, { directions: [], count: 0 });
            }

            const day = dayMap.get(item.dateKey);
            day.count += 1;
            day.directions.push(item.direction);
        });

        const days = [...dayMap.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([dayDate, value]) => ({
                date: dayDate,
                interestCount: value.count,
                demandLevel: getDemandLevel(value.count),
                routeLabel: getRouteLabel(value.directions),
            }));

        return {
            filters: {
                month: month ? parseInt(month, 10) : null,
                year: year ? parseInt(year, 10) : null,
                from: startDate || null,
                to: endDate || null,
                direction: direction || null,
            },
            days,
        };
    }

    async getInterestDetails(id) {
        const request = await prisma.customTravelRequest.findUnique({
            where: { id },
            include: {
                member: {
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
                },
                passengers: true,
            },
        });

        if (!request) {
            throw new Error('Interest not found');
        }

        const routes = [
            {
                label: formatDirectionLabel(request.direction),
                origin: request.origin,
                destination: request.destination,
                date: request.departureDate,
                dateLabel: formatDisplayDate(request.departureDate),
                scheduleType: 'Departure',
            },
        ];

        if (request.tripType === 'ROUND_TRIP' && request.returnOrigin && request.returnDestination) {
            routes.push({
                label: formatDirectionLabel(request.returnDirection),
                origin: request.returnOrigin,
                destination: request.returnDestination,
                date: request.returnDate,
                dateLabel: formatDisplayDate(request.returnDate),
                scheduleType: 'Return',
            });
        }

        return {
            id: request.id,
            source: 'CUSTOM_TRAVEL',
            member: {
                id: request.member.id,
                name: formatMemberName(request.member),
                email: request.member.email,
                phone: request.member.phone,
                address: [request.member.address, request.member.city, request.member.state, request.member.zipCode]
                    .filter(Boolean)
                    .join(', ') || null,
            },
            route: formatDirectionLabel(request.direction),
            tripType: request.tripType,
            tripTypeLabel: formatTripTypeLabel(request.tripType),
            status: 'INTERESTED',
            passengerCount: request.passengerCount,
            routes,
            passengers: request.passengers.map((passenger, index) => ({
                label: `Passenger ${index + 1}`,
                firstName: passenger.firstName,
                lastName: passenger.lastName,
                fullName: `${passenger.firstName} ${passenger.lastName}`.trim(),
                address: [passenger.address, passenger.zipCode].filter(Boolean).join(', ') || null,
                email: passenger.email,
                phone: passenger.phone,
            })),
            specialRequests: request.specialRequests,
            createdAt: request.createdAt,
        };
    }
}
export default new StaffService();