import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';

const safeUser = { omit: { password: true } };

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

        return await prisma.user.create({
            ...safeUser,
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone: phone ?? null,
                role: 'CONCIERGE',
                status: 'ACTIVE',
            },
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
}
export default new AdminService();