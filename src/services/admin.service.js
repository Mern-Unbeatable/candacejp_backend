import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import {
    countScheduledFlights,
    getScheduledFlightConfirmations,
} from '../utils/dashboardMetrics.js';

const safeUser = { omit: { password: true } };
const REGISTRATION_FEE_USD = 199;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getYearBounds(year) {
    const parsedYear = Number.parseInt(year, 10) || new Date().getUTCFullYear();
    return {
        year: parsedYear,
        start: new Date(Date.UTC(parsedYear, 0, 1)),
        end: new Date(Date.UTC(parsedYear + 1, 0, 1)),
    };
}

function toMonthlyBuckets(records, dateKey = 'createdAt') {
    const buckets = Array.from({ length: 12 }, (_, index) => ({
        month: MONTH_LABELS[index],
        value: 0,
    }));

    records.forEach((record) => {
        const date = record[dateKey];
        if (!date) return;
        const monthIndex = new Date(date).getUTCMonth();
        if (monthIndex >= 0 && monthIndex <= 11) {
            buckets[monthIndex].value += 1;
        }
    });

    return buckets;
}

function parseName({ name, firstName, lastName }) {
    if (firstName !== undefined || lastName !== undefined) {
        return {
            firstName: firstName?.trim() || null,
            lastName: lastName?.trim() || null,
        };
    }

    if (!name?.trim()) {
        return { firstName: null, lastName: null };
    }

    const trimmed = name.trim();
    const spaceIndex = trimmed.indexOf(' ');

    if (spaceIndex === -1) {
        return { firstName: trimmed, lastName: null };
    }

    return {
        firstName: trimmed.slice(0, spaceIndex),
        lastName: trimmed.slice(spaceIndex + 1).trim() || null,
    };
}

class AdminService {
    // Concierge Staff Management
    async addConciergeStaff(data) {
        const { email, password, phone } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new Error('A user with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
        const { firstName, lastName } = parseName(data);

        return prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                ...safeUser,
                data: {
                    email,
                    password: hashedPassword,
                    name: [firstName, lastName].filter(Boolean).join(' '),
                    firstName,
                    lastName,
                    phone: phone ?? null,
                    role: 'CONCIERGE',
                    status: 'ACTIVE',
                },
            });

            await tx.account.create({
                data: {
                    accountId: user.id,
                    providerId: 'credential',
                    userId: user.id,
                    password: hashedPassword,
                },
            });

            return user;
        });
    }

    async getAllStaff(page = 1, limit = 10) {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const perPage = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * perPage;

        const where = { role: 'CONCIERGE' };

        const [staff, total] = await Promise.all([
            prisma.user.findMany({
                ...safeUser,
                where,
                skip,
                take: perPage,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            staff,
            pagination: buildPagination(currentPage, perPage, total),
        };
    }

    async updateStaffStatus(id, status) {
        return await prisma.user.update({
            ...safeUser,
            where: { id },
            data: { status } // 'ACTIVE' or 'INACTIVE'
        });
    }

    async deleteStaff(id) {
        const staff = await prisma.user.findUnique({
            where: { id, role: 'CONCIERGE' },
        });

        if (!staff) {
            throw new Error('Staff not found');
        }

        await prisma.user.delete({ where: { id } });
    }

    // Get individual concierge
    async getStaffById(id) {
        return await prisma.user.findUnique({ ...safeUser, where: { id, role: 'CONCIERGE' } });
    }
    // Full update (PUT)
    async updateStaffDetails(id, data) {
        const { firstName, lastName } = parseName(data);

        return await prisma.user.update({
            ...safeUser,
            where: { id },
            data: {
                name: [firstName, lastName].filter(Boolean).join(' '),
                firstName,
                lastName,
                phone: data.phone ?? null,
                email: data.email,
            },
        });
    }
    // Member Management
    async getAllMembers(page = 1, limit = 10) {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const perPage = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * perPage;

        const where = { role: 'MEMBER' };

        const [members, total] = await Promise.all([
            prisma.user.findMany({
                ...safeUser,
                where,
                skip,
                take: perPage,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            members,
            pagination: buildPagination(currentPage, perPage, total),
        };
    }

    async getMemberById(id) {
        return await prisma.user.findUnique({ ...safeUser, where: { id } });
    }
    // Update member information
    async updateMember(id, data) {
        return await prisma.user.update({
            ...safeUser,
            where: { id, role: 'MEMBER' },
            data: {
                name: [data.firstName, data.lastName].filter(Boolean).join(' '),
                firstName: data.firstName,
                lastName: data.lastName,
                address: data.address,
                zipCode: data.zipCode,
                city: data.city,
                state: data.state,
                phone: data.phone,
                email: data.email
            }
        });
    }

    async getDashboardOverview() {
        const [
            totalMembers,
            totalStaff,
            totalCustomTravelInterests,
            totalTravelPreferences,
            activeMembers,
            memberRegistrations,
            travelPreferenceDirections,
            customTravelDirections,
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'MEMBER' } }),
            prisma.user.count({ where: { role: 'CONCIERGE' } }),
            prisma.customTravelRequest.count(),
            prisma.travelPreference.count(),
            prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
            prisma.user.findMany({
                where: { role: 'MEMBER' },
                select: { createdAt: true },
            }),
            prisma.travelPreference.findMany({
                select: { direction: true },
            }),
            prisma.customTravelRequest.findMany({
                select: { direction: true },
            }),
        ]);

        const routeCounts = { NYC_TAMPA: 0, TAMPA_NYC: 0 };
        [...travelPreferenceDirections, ...customTravelDirections].forEach(({ direction }) => {
            if (routeCounts[direction] !== undefined) {
                routeCounts[direction] += 1;
            }
        });
        const routeTotal = routeCounts.NYC_TAMPA + routeCounts.TAMPA_NYC;

        return {
            totals: {
                totalMembers,
                totalStaff,
                totalInterest: totalCustomTravelInterests + totalTravelPreferences,
                totalRevenue: activeMembers * REGISTRATION_FEE_USD,
                currency: 'USD',
                registrationFee: REGISTRATION_FEE_USD,
            },
            demandOverview: toMonthlyBuckets(memberRegistrations),
            popularRoutes: [
                {
                    route: 'NYC → Tampa',
                    count: routeCounts.NYC_TAMPA,
                    percentage: routeTotal ? Number(((routeCounts.NYC_TAMPA / routeTotal) * 100).toFixed(1)) : 0,
                },
                {
                    route: 'Tampa → NYC',
                    count: routeCounts.TAMPA_NYC,
                    percentage: routeTotal ? Number(((routeCounts.TAMPA_NYC / routeTotal) * 100).toFixed(1)) : 0,
                },
            ],
        };
    }

    async getMembersOverTime(year) {
        const { year: selectedYear, start, end } = getYearBounds(year);
        const records = await prisma.user.findMany({
            where: { role: 'MEMBER', createdAt: { gte: start, lt: end } },
            select: { createdAt: true },
        });

        return {
            year: selectedYear,
            membersOverTime: toMonthlyBuckets(records),
        };
    }

    async getMonthlyActivity(year) {
        const { year: selectedYear, start, end } = getYearBounds(year);
        const [opportunities, reservations, scheduledFlightConfirmations] = await Promise.all([
            prisma.opportunity.findMany({
                where: { createdAt: { gte: start, lt: end } },
                select: { createdAt: true },
            }),
            prisma.reservation.findMany({
                where: { createdAt: { gte: start, lt: end } },
                select: { createdAt: true },
            }),
            getScheduledFlightConfirmations(prisma, { start, end }),
        ]);

        const opportunityBuckets = toMonthlyBuckets(opportunities);
        const reservationBuckets = toMonthlyBuckets(reservations);
        const flightBookedBuckets = toMonthlyBuckets(scheduledFlightConfirmations, 'updatedAt');

        return {
            year: selectedYear,
            monthlyActivity: MONTH_LABELS.map((month, index) => ({
                month,
                travelOpportunities: opportunityBuckets[index].value,
                reservations: reservationBuckets[index].value,
                flightsBooked: flightBookedBuckets[index].value,
            })),
        };
    }
}
export default new AdminService();